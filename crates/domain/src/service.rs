//! Service — orchestration pure. Pas de business logic, pas d'état.

use std::sync::{Arc, RwLock};

use chrono::Utc;
use thiserror::Error;

use crate::command::{apply, Command, CommandError, Event};
use crate::graph::Graph;
use crate::ports::{EventBus, GraphRepository, KindRepository, MediaRepository, RepositoryError};
use crate::primitives::NodeId;
use crate::query::{evaluate_query_node, QueryBuilder};
use crate::registry::{CoreLibrary, KindRegistry};
use crate::resolver::SchemaResolver;

// ── Erreurs ───────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Command error: {0}")]
    Command(#[from] CommandError),
    #[error("Storage error: {0}")]
    Storage(#[from] RepositoryError),
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Registry lock poisoned")]
    LockPoisoned,
}

// ── Service ───────────────────────────────────────────────────────────────────

/// Orchestrateur stateless — délègue la logique métier à `apply()`,
/// la persistance aux repos, la notification à l'EventBus.
///
/// Le graph n'est PAS stocké ici — il vient du port `GraphRepository`.
/// Si l'impl est `InMemoryGraphRepository`, `load_graph()` est O(1).
pub struct Service<R, K, E, M>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    M: MediaRepository,
{
    repo: R,
    kind_repo: K,
    bus: E,
    media_repo: M,
    /// Registry rechargé depuis `KindRepository` à chaque `execute()`
    /// pour prendre en compte les kinds lua ajoutés à chaud.
    registry: Arc<RwLock<KindRegistry>>,
}

impl<R, K, E, M> Service<R, K, E, M>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    M: MediaRepository,
{
    pub fn new(repo: R, kind_repo: K, bus: E, media_repo: M) -> Self {
        let mut registry = KindRegistry::new();
        CoreLibrary::init(&mut registry);
        Self {
            repo,
            kind_repo,
            bus,
            media_repo,
            registry: Arc::new(RwLock::new(registry)),
        }
    }

    /// Recharge les kinds user-defined depuis le KindRepository.
    /// Appelé au démarrage et à chaque ajout de plugin.
    pub fn refresh_kinds(&self) -> Result<(), ServiceError> {
        let user_kinds = self.kind_repo.load_kinds()?;
        let mut registry = self.registry.write().map_err(|_| ServiceError::LockPoisoned)?;
        for (kind, def) in user_kinds {
            registry.register(kind, def);
        }
        Ok(())
    }

    // ── Mutations ─────────────────────────────────────────────────────────────

    /// Exécute une commande : load → apply → persist → publish.
    pub fn execute(&self, cmd: Command) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self.registry.read().map_err(|_| ServiceError::LockPoisoned)?;

        let event = apply(&mut graph, &registry, cmd, Utc::now())?;

        drop(registry); // libère le read lock avant l'I/O
        self.repo.apply_event(&event)?;
        self.bus.publish(&event);

        Ok(event)
    }

    /// Exécute plusieurs commandes de façon atomique (all-or-nothing).
    /// Si une commande échoue, le graph n'est pas modifié.
    pub fn execute_batch(&self, cmds: Vec<Command>) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self.registry.read().map_err(|_| ServiceError::LockPoisoned)?;

        // Snapshot pour le rollback
        let snapshot = graph.clone();

        let mut events = Vec::new();
        let now = Utc::now();

        for cmd in cmds {
            match apply(&mut graph, &registry, cmd, now) {
                Ok(event) => events.push(event),
                Err(e) => {
                    // Rollback : le repo n'a pas encore été touché
                    drop(graph);
                    drop(snapshot);
                    return Err(ServiceError::Command(e));
                }
            }
        }

        drop(registry);
        let batch_event = Event::Batch(events);
        self.repo.apply_event(&batch_event)?;
        self.bus.publish(&batch_event);

        Ok(batch_event)
    }

    // ── Lectures ──────────────────────────────────────────────────────────────

    /// Exécute une query en lecture seule.
    pub fn execute_query(&self, builder: QueryBuilder) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(builder.execute(&graph))
    }

    /// Évalue un node `core.query` sauvegardé.
    pub fn evaluate_query_node(&self, query_node_id: NodeId) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(evaluate_query_node(&graph, query_node_id))
    }

    /// Valide un node dans son contexte graphe.
    pub fn validate_node_in_context(&self, node_id: NodeId) -> Result<(), ServiceError> {
        let graph = self.repo.load_graph()?;
        let registry = self.registry.read().map_err(|_| ServiceError::LockPoisoned)?;
        let resolver = SchemaResolver::new(&graph, &registry);
        resolver.validate_in_context(node_id)
            .map_err(|_e| ServiceError::Command(CommandError::NotFound(node_id)))
    }

    /// Accès direct au graph (pour les lectures rapides côté GUI).
    pub fn load_graph(&self) -> Result<Graph, ServiceError> {
        Ok(self.repo.load_graph()?)
    }

    /// Récupère les métadonnées du workspace.
    pub fn get_meta(&self) -> Result<crate::workspace::WorkspaceMeta, ServiceError> {
        Ok(self.repo.load_meta()?)
    }

    /// Récupère tous les kinds enregistrés (core + user).
    pub fn get_all_kinds(&self) -> Result<Vec<(crate::primitives::Kind, crate::schema::KindDef)>, ServiceError> {
        let registry = self.registry.read().map_err(|_| ServiceError::LockPoisoned)?;
        Ok(registry.iter().map(|(k, d)| (k.clone(), d.clone())).collect())
    }

    /// Enregistre un nouveau kind user-defined et le persiste.
    pub fn register_kind(&self, kind: crate::primitives::Kind, def: crate::schema::KindDef) -> Result<(), ServiceError> {
        self.kind_repo.save_kind(&kind, &def)?;
        let mut registry = self.registry.write().map_err(|_| ServiceError::LockPoisoned)?;
        registry.register(kind, def);
        Ok(())
    }

    /// Supprime un kind user-defined de la persistance et du registry.
    pub fn delete_kind(&self, kind: &crate::primitives::Kind) -> Result<(), ServiceError> {
        self.kind_repo.delete_kind(kind)?;
        let mut registry = self.registry.write().map_err(|_| ServiceError::LockPoisoned)?;
        registry.unregister(kind);
        Ok(())
    }

    // ── Médias ────────────────────────────────────────────────────────────────

    /// Importe un fichier média (ex: image) dans l'espace de stockage
    /// et retourne l'URL relative à utiliser dans les nœuds.
    pub fn import_media(&self, source_path: &str) -> Result<String, ServiceError> {
        Ok(self.media_repo.import_media(source_path)?)
    }
}

//! Ports hexagonaux — interfaces définies par le domain, implémentées par l'infra.

use crate::command::Event;
use crate::graph::Graph;
use crate::primitives::Kind;
use crate::schema::KindDef;
use crate::workspace::WorkspaceMeta;

// ── RepositoryError ───────────────────────────────────────────────────────────

/// Type d'erreur défini par le domain — l'infra mappe ses erreurs concrètes ici.
/// Aucune dépendance externe (pas d'anyhow).
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Corrupted data: {0}")]
    Corrupted(String),
    #[error("I/O error: {0}")]
    Io(String),
}

// ── GraphRepository ───────────────────────────────────────────────────────────

/// Port pour la persistance du graph.
/// L'implémentation peut être :
///   - `InMemoryGraphRepository` (prod) : cache + flush disk
///   - `FileGraphRepository` (tests/CLI) : disk pur, sans cache
pub trait GraphRepository: Send + Sync + 'static {
    fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError>;
    fn save_meta(&self, meta: &WorkspaceMeta) -> Result<(), RepositoryError>;

    /// Charge le graph complet. Peut être O(1) si l'impl cache en mémoire.
    fn load_graph(&self) -> Result<Graph, RepositoryError>;

    /// Save granulaire — l'infra sait exactement quels nodes ont changé.
    fn apply_event(&self, event: &Event) -> Result<(), RepositoryError>;

    /// Save complet — pour les migrations et backups.
    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError>;
}

// ── KindRepository ────────────────────────────────────────────────────────────

/// Port pour la persistance des KindDefs user-defined (plugins lua, etc.).
pub trait KindRepository: Send + Sync + 'static {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError>;
    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError>;
    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError>;
}

// ── EventBus ──────────────────────────────────────────────────────────────────

/// Port pour publier les Events vers le GUI.
pub trait EventBus: Send + Sync + 'static {
    fn publish(&self, event: &Event);
}

/// Impl vide pour les tests — aucun side-effect.
impl EventBus for () {
    fn publish(&self, _event: &Event) {}
}

// ── MediaRepository ───────────────────────────────────────────────────────────

/// Port pour la gestion des fichiers médias (images, vidéos, etc.).
pub trait MediaRepository: Send + Sync + 'static {
    /// Importe un média depuis un chemin source vers l'espace de stockage
    /// et retourne l'URL relative à enregistrer dans le domaine.
    fn import_media(&self, source_path: &str) -> Result<String, RepositoryError>;
}

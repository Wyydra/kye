use std::sync::{Arc, RwLock};
use chrono::Utc;
use thiserror::Error;

use crate::command::{apply, Command, CommandError, Event};
use crate::graph::Graph;
use crate::model::remote::RemoteError;
use crate::model::workspace::WorkspaceMeta;
use crate::ports::{
    AssetRepository, EventBus, GraphRepository, KindRepository, RepositoryError, SystemShellPort, SyncError,
};
use crate::primitives::{Kind, NodeId};
use crate::query::{evaluate_query_node, QueryBuilder};
use crate::registry::{CoreLibrary, KindRegistry};
use crate::resolver::SchemaResolver;
use crate::schema::KindDef;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Command error: {0}")]
    Command(#[from] CommandError),
    #[error("Storage error: {0}")]
    Storage(#[from] RepositoryError),
    #[error("Sync error: {0}")]
    Sync(#[from] SyncError),
    #[error("Remote error: {0}")]
    Remote(#[from] RemoteError),
    #[error("Remote not found: '{0}'")]
    RemoteNotFound(String),
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Registry lock poisoned")]
    LockPoisoned,
}

pub struct Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub(super) repo: R,
    pub(super) kind_repo: K,
    pub(super) bus: E,
    pub(super) asset_repo: A,
    pub(super) shell: S,
    pub(super) registry: Arc<RwLock<KindRegistry>>,
}

impl<R, K, E, A, S> Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub fn new(repo: R, kind_repo: K, bus: E, asset_repo: A, shell: S) -> Self {
        let mut registry = KindRegistry::new();
        CoreLibrary::init(&mut registry);
        Self {
            repo,
            kind_repo,
            bus,
            asset_repo,
            shell,
            registry: Arc::new(RwLock::new(registry)),
        }
    }

    pub fn load_graph(&self) -> Result<Graph, ServiceError> {
        Ok(self.repo.load_graph()?)
    }

    pub fn get_meta(&self) -> Result<WorkspaceMeta, ServiceError> {
        Ok(self.repo.load_meta()?)
    }

    pub fn open_external(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.shell.open_external(target_path)?)
    }

    pub fn reveal_in_explorer(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.shell.reveal_in_explorer(target_path)?)
    }

    pub fn execute(&self, cmd: Command) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let event = apply(&mut graph, &registry, cmd, Utc::now())?;

        drop(registry);
        self.repo.apply_event(&event)?;
        self.bus.publish(&event);

        Ok(event)
    }

    pub fn execute_batch(&self, cmds: Vec<Command>) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let snapshot = graph.clone();
        let mut events = Vec::new();
        let now = Utc::now();

        for cmd in cmds {
            match apply(&mut graph, &registry, cmd, now) {
                Ok(event) => events.push(event),
                Err(e) => {
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

    pub fn execute_query(&self, builder: QueryBuilder) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(builder.execute(&graph))
    }

    pub fn evaluate_query_node(&self, query_node_id: NodeId) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(evaluate_query_node(&graph, query_node_id))
    }

    pub fn validate_node_in_context(&self, node_id: NodeId) -> Result<(), ServiceError> {
        let graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;
        let resolver = SchemaResolver::new(&graph, &registry);
        resolver
            .validate_in_context(node_id)
            .map_err(|_e| ServiceError::Command(CommandError::NotFound(node_id)))
    }

    pub fn refresh_kinds(&self) -> Result<(), ServiceError> {
        let user_kinds = self.kind_repo.load_kinds()?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        for (kind, def) in user_kinds {
            registry.register(kind, def);
        }
        Ok(())
    }

    pub fn get_all_kinds(&self) -> Result<Vec<(Kind, KindDef)>, ServiceError> {
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;
        Ok(registry
            .iter()
            .map(|(k, d)| (k.clone(), d.clone()))
            .collect())
    }

    pub fn register_kind(&self, kind: Kind, def: KindDef) -> Result<(), ServiceError> {
        self.kind_repo.save_kind(&kind, &def)?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        registry.register(kind, def);
        Ok(())
    }

    pub fn delete_kind(&self, kind: &Kind) -> Result<(), ServiceError> {
        self.kind_repo.delete_kind(kind)?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        registry.unregister(kind);
        Ok(())
    }
}

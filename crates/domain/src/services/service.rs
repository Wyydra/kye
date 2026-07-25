use std::sync::{Arc, RwLock};
use thiserror::Error;

use crate::command::CommandError;
use crate::graph::Graph;
use crate::model::remote::RemoteError;
use crate::model::workspace::WorkspaceMeta;
use crate::ports::{
    AssetRepository, EventBus, GraphRepository, KindRepository, RepositoryError, SyncError,
};
use crate::primitives::NodeId;
use crate::registry::{CoreLibrary, KindRegistry};

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

pub struct Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub(super) repo: R,
    pub(super) kind_repo: K,
    pub(super) bus: E,
    pub(super) asset_repo: A,
    pub(super) registry: Arc<RwLock<KindRegistry>>,
}

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn new(repo: R, kind_repo: K, bus: E, asset_repo: A) -> Self {
        let mut registry = KindRegistry::new();
        CoreLibrary::init(&mut registry);
        Self {
            repo,
            kind_repo,
            bus,
            asset_repo,
            registry: Arc::new(RwLock::new(registry)),
        }
    }

    pub fn load_graph(&self) -> Result<Graph, ServiceError> {
        Ok(self.repo.load_graph()?)
    }

    pub fn get_meta(&self) -> Result<WorkspaceMeta, ServiceError> {
        Ok(self.repo.load_meta()?)
    }
}

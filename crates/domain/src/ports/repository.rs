use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::model::graph::Graph;
use crate::model::primitives::{Kind, NodeId};
use crate::model::schema::KindDef;
use crate::model::workspace::WorkspaceMeta;
use crate::services::command::Event;

#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Corrupted data: {0}")]
    Corrupted(String),
    #[error("I/O error: {0}")]
    Io(String),
}

pub trait GraphRepository: Send + Sync + 'static {
    fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError>;
    fn save_meta(&self, meta: &WorkspaceMeta) -> Result<(), RepositoryError>;

    fn load_graph(&self) -> Result<Graph, RepositoryError>;

    fn apply_event(&self, event: &Event) -> Result<(), RepositoryError>;

    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError>;

    fn load_tombstones(&self) -> Result<HashMap<NodeId, DateTime<Utc>>, RepositoryError>;
}

pub trait KindRepository: Send + Sync + 'static {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError>;
    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError>;
    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError>;
}

pub trait AssetRepository: Send + Sync + 'static {
    fn save_asset(&self, filename: &str, data: &[u8]) -> Result<String, RepositoryError>;
    fn read_asset(&self, target: &str) -> Result<Vec<u8>, RepositoryError>;
}

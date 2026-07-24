use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::model::asset::AssetInfo;
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
    fn import_media(&self, source_path: &str) -> Result<String, RepositoryError>;
    fn save_media(&self, data: &[u8], extension: &str) -> Result<String, RepositoryError>;

    fn import_asset(&self, source_path: &str) -> Result<AssetInfo, RepositoryError>;
    fn open_external(&self, target_path: &str) -> Result<(), RepositoryError>;
    fn reveal_in_explorer(&self, target_path: &str) -> Result<(), RepositoryError>;
}

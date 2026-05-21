

use crate::command::Event;
use crate::graph::Graph;
use crate::primitives::Kind;
use crate::schema::KindDef;
use crate::workspace::WorkspaceMeta;

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

    fn load_tombstones(&self) -> Result<std::collections::HashMap<crate::primitives::NodeId, chrono::DateTime<chrono::Utc>>, RepositoryError>;
}

pub trait KindRepository: Send + Sync + 'static {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError>;
    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError>;
    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError>;
}

pub trait EventBus: Send + Sync + 'static {
    fn publish(&self, event: &Event);
}

impl EventBus for () {
    fn publish(&self, _event: &Event) {}
}

pub trait MediaRepository: Send + Sync + 'static {

    fn import_media(&self, source_path: &str) -> Result<String, RepositoryError>;

    fn save_media(&self, data: &[u8], extension: &str) -> Result<String, RepositoryError>;
}

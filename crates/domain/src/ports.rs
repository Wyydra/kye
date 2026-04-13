use crate::models::block::{Block, CreateBlockError, CreateBlockRequest, UpdateBlockRequest, UpdateBlockError};
use crate::models::workspace::{Workspace, SaveWorkspaceError};
use uuid::Uuid;


pub trait BlockService: Clone + Send + Sync + 'static {
    fn get_workspace(&self) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn create_block(&self, req: &CreateBlockRequest) -> impl Future<Output = Result<(Workspace, Uuid), CreateBlockError>> + Send;
    fn update_block(&self, req: &UpdateBlockRequest) -> impl Future<Output = Result<Workspace, UpdateBlockError>> + Send;
    fn delete_block(&self, id: Uuid) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn get_block_types(&self) -> Vec<String>;
    fn identify_block_shapes(&self, fields: &crate::models::block::metadata::Fields) -> Vec<String>;
    fn notify_external_update(&self);
}

pub trait EventDispatcher: Clone + Send + Sync + 'static {
    fn dispatch_workspace_updated(&self);
}

impl EventDispatcher for () {
    fn dispatch_workspace_updated(&self) {}
}
pub trait WorkspaceRepository: Send + Sync + Clone + 'static {
    fn load_workspace(&self) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn save_workspace(&self, workspace: &Workspace) -> impl Future<Output = Result<(), SaveWorkspaceError>> + Send;
}

pub trait WorkspaceWatcher: Send + Sync + 'static {
    fn watch(&self);
}

pub trait MetadataProvider: Send + Sync {
    fn get_id(&self) -> Option<Uuid>;
    fn get_fields(&self) -> Result<crate::models::block::metadata::Fields, String>;
}

use crate::models::block::{Block, CreateBlockError, CreateBlockRequest};
use crate::models::workspace::{Workspace, SaveWorkspaceError};

pub trait BlockService: Clone + Send + Sync + 'static {
    fn get_workspace(&self) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn create_block(&self, req: &CreateBlockRequest) -> impl Future<Output = Result<Block, CreateBlockError>> + Send;
}


pub trait WorkspaceRepository: Send + Sync + Clone + 'static {
    fn load_workspace(&self) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn save_workspace(&self, workspace: &Workspace) -> impl Future<Output = Result<(), SaveWorkspaceError>> + Send;
}


use crate::models::block::{Block, CreateBlockError, CreateBlockRequest};

pub trait WorkspaceRepository: Send + Sync + Clone + 'static {
    fn create_block(&self, req: &CreateBlockRequest) -> impl Future<Output = Result<Block, CreateBlockError>> + Send;
}

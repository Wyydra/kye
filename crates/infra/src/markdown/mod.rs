use domain::{models::{block::{Block, CreateBlockError, CreateBlockRequest}, workspace::Workspace}, ports::WorkspaceRepository};

#[derive(Debug, Clone)]
pub struct MarkdownWorkspaceRepository {
    path: std::path::PathBuf,
}

impl MarkdownWorkspaceRepository {
    pub fn new(path: std::path::PathBuf) -> Self {
        Self { path }
    }
}

impl WorkspaceRepository for MarkdownWorkspaceRepository {
    async fn create_block(&self, req: &CreateBlockRequest) -> Result<Block, CreateBlockError> {
        todo!()
    }
}

use uuid::Uuid;

use crate::{
    models::{
        block::{Block, CreateBlockError, CreateBlockRequest, UpdateBlockRequest, UpdateBlockError},
        workspace::Workspace,
    },
    ports::{BlockService, WorkspaceRepository, EventDispatcher},
};

#[derive(Debug, Clone)]
pub struct Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    repo: R,
    dispatcher: E,
}

impl<R, E> Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    pub fn new(repo: R, dispatcher: E) -> Self {
        Self { repo, dispatcher }
    }

    pub fn notify_external_update(&self) {
        self.dispatcher.dispatch_workspace_updated();
    }
}

impl<R, E> BlockService for Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    async fn get_workspace(&self) -> Result<Workspace, anyhow::Error> {
        self.repo.load_workspace().await
    }

    async fn create_block(&self, req: &CreateBlockRequest) -> Result<Block, CreateBlockError> {
        let mut workspace = self.repo.load_workspace().await.map_err(|e| {
            CreateBlockError::Unknown(anyhow::anyhow!("Loading error: {}", e))
        })?;

        let id = Uuid::new_v4();
        let new_block = Block::new(id, req.content().clone(), req.metadata().clone());

        workspace.add_block(new_block.clone()).map_err(|e| {
            CreateBlockError::Unknown(anyhow::anyhow!("Validation error: {}", e))
        })?;

        self.repo.save_workspace(&workspace).await?;

        Ok(new_block)
    }

    async fn update_block(&self, req: &UpdateBlockRequest) -> Result<(), UpdateBlockError> {
        let mut workspace = self.repo.load_workspace().await.map_err(|e| {
            UpdateBlockError::Unknown(anyhow::anyhow!("Loading error: {}", e))
        })?;

        workspace.update_block_content(req.id(), req.content().clone())?;
        self.repo.save_workspace(&workspace).await?;

        Ok(())
    }
}

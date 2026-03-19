use uuid::Uuid;

use crate::{models::{block::{Block, CreateBlockError, CreateBlockRequest}, workspace::Workspace}, ports::{BlockService, WorkspaceRepository}};

#[derive(Debug, Clone)]
pub struct Service<R>
where
    R: WorkspaceRepository,
{
    repo: R,
}

impl<R> Service<R>
where
    R: WorkspaceRepository,
{
    pub fn new(repo: R) -> Self {
        Self { repo }
    }
}

impl<R> BlockService for Service<R> 
where 
    R: WorkspaceRepository 
{
    async fn get_workspace(&self) -> Result<Workspace, anyhow::Error> {
        self.repo.load_workspace().await
    }

    async fn create_block(&self, req: &CreateBlockRequest) -> Result<Block, CreateBlockError> {
        let mut workspace = self.repo.load_workspace()
            .await
            .map_err(|e| CreateBlockError::Unknown(anyhow::anyhow!("Erreur de chargement: {}", e)))?;

        let id = Uuid::new_v4();
        let new_block = Block::new(id, req.content().clone(), req.metadata().clone());

        workspace.add_block(new_block.clone())
            .map_err(|e| CreateBlockError::Unknown(anyhow::anyhow!("Validation métier échouée: {}", e)))?;

        self.repo.save_workspace(&workspace).await?;
        
        Ok(new_block)
    }
}

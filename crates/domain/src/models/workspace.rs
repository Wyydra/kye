use std::fmt::Display;
use thiserror::Error;
use uuid::Uuid;
use crate::models::block::Block;

pub struct Workspace {
    id: Uuid,
    name: WorkspaceName,
    blocks: Vec<Block>,
}

impl Workspace {
    pub fn new(id: Uuid, name: WorkspaceName, blocks: Vec<Block>) -> Self {
        Self { id, name, blocks }
    }
    pub fn id(&self) -> &Uuid {
        &self.id
    }
    pub fn name(&self) -> &WorkspaceName {
        &self.name
    }
    pub fn blocks(&self) -> &Vec<Block> {
        &self.blocks
    }
}

pub struct WorkspaceName(String);

#[derive(Clone, Debug, Error)]
#[error("Workspace name cannot be empty")]
pub struct WorkspaceNameEmptyError;

impl WorkspaceName {
    pub fn new(raw: &str) -> Result<Self, WorkspaceNameEmptyError> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(WorkspaceNameEmptyError);
        }
        Ok(Self(trimmed.to_string()))
    }
}

impl Display for WorkspaceName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

pub struct CreateWorkspaceRequest {
    name: String,
}

impl CreateWorkspaceRequest {
    pub fn new(name: String) -> Self {
        Self { name }
    }
    pub fn name(&self) -> &str {
        &self.name
    }
}

#[derive(Debug, Error)]
pub enum CreateWorkspaceError {
    #[error(transparent)]
    Unknown(#[from] anyhow::Error),
}


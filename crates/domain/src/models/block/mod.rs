use thiserror::Error;
use uuid::Uuid;

use crate::models::block::schema::Fields;

pub mod schema;
pub mod stdlib;
pub mod type_registry;

#[derive(Debug, Clone)]
pub struct Block {
    id: Uuid,
    fields: Fields,
}

impl Block {
    pub fn new(id: Uuid, fields: Fields) -> Self {
        Self { id, fields }
    }
    
    pub fn id(&self) -> &uuid::Uuid {
        &self.id
    }
    
    pub fn fields(&self) -> &Fields {
        &self.fields
    }

    pub fn apply_changes(
        &mut self,
        new_fields: Fields,
    ) {
        self.fields = new_fields;
    }
}

pub struct CreateBlockRequest {
    fields: Fields,
}

impl CreateBlockRequest {
    pub fn new(fields: Fields) -> Self {
        Self { fields }
    }
    
    pub fn fields(&self) -> &Fields {
        &self.fields
    }
}

pub struct UpdateBlockRequest {
    id: uuid::Uuid,
    fields: Fields,
}

impl UpdateBlockRequest {
    pub fn new(id: uuid::Uuid, fields: Fields) -> Self {
        Self { id, fields }
    }

    pub fn id(&self) -> uuid::Uuid {
        self.id
    }
    
    pub fn fields(&self) -> &Fields {
        &self.fields
    }
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum CreateBlockError {
    #[error("Block with ID {0} already exists")]
    DuplicateId(Uuid),
    #[error(transparent)]
    Storage(#[from] crate::models::workspace::SaveWorkspaceError),
    #[error(transparent)]
    Unknown(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
pub enum UpdateBlockError {
    #[error("Block {0} not found")]
    NotFound(uuid::Uuid),
    #[error(transparent)]
    Storage(#[from] crate::models::workspace::SaveWorkspaceError),
    #[error(transparent)]
    Unknown(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
pub enum DeleteBlockError {
    #[error("Block {0} not found")]
    NotFound(Uuid),
    #[error(transparent)]
    Storage(#[from] crate::models::workspace::SaveWorkspaceError),
    #[error(transparent)]
    Unknown(#[from] anyhow::Error),
}

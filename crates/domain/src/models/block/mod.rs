use std::fmt::Display;

use thiserror::Error;

use crate::models::block::metadata::{Metadata, Fields};

pub mod metadata;
pub mod schema;
pub mod stdlib;
pub mod type_registry;

#[derive(Debug, Clone)]
pub struct Block {
    content: Content,
    metadata: Metadata,
}

impl Block {
    pub fn new(content: Content, metadata: Metadata) -> Self {
        Self {
            content,
            metadata,
        }
    }
    pub fn id(&self) -> &uuid::Uuid {
        self.metadata.id()
    }
    pub fn content(&self) -> &Content {
        &self.content
    }
    pub fn metadata(&self) -> &Metadata {
        &self.metadata
    }

    pub fn update_content(&mut self, new_content: Content) {
        self.content = new_content;
    }

    pub fn update_metadata(&mut self, new_fields: Fields) {
        self.metadata = Metadata::new(*self.id(), new_fields);
    }
}

#[derive(Clone, Debug)]
pub struct Content(String);

impl Content {
    pub fn new(raw: &str) -> Self {
        let trimmed = raw.trim();
        Self(trimmed.to_string())
    }
}

impl Display for Content {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

pub struct CreateBlockRequest {
    content: Content,
    fields: Fields,
}

impl CreateBlockRequest {
    pub fn new(content: Content, fields: Fields) -> Self {
        Self { content, fields }
    }
    pub fn content(&self) -> &Content {
        &self.content
    }
    pub fn fields(&self) -> &Fields {
        &self.fields
    }
}

pub struct UpdateBlockRequest {
    id: uuid::Uuid,
    content: Option<Content>,
    fields: Option<Fields>,
}

impl UpdateBlockRequest {
    pub fn new(id: uuid::Uuid, content: Option<Content>, fields: Option<Fields>) -> Self {
        Self { id, content, fields }
    }
    pub fn id(&self) -> uuid::Uuid {
        self.id
    }
    pub fn content(&self) -> Option<&Content> {
        self.content.as_ref()
    }
    pub fn fields(&self) -> Option<&Fields> {
        self.fields.as_ref()
    }
}

#[derive(Debug, Error)]
pub enum CreateBlockError {
    #[error("Storage error")]
    Storage(#[from] crate::models::workspace::SaveWorkspaceError),
    #[error("Unknown error")]
    Unknown(#[from] anyhow::Error),
}

#[derive(Debug, Error)]
pub enum UpdateBlockError {
    #[error("Block {0} not found")]
    NotFound(uuid::Uuid),
    #[error("Storage error")]
    Storage(#[from] crate::models::workspace::SaveWorkspaceError),
    #[error("Unknown error")]
    Unknown(#[from] anyhow::Error),
}

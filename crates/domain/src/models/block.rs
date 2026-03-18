use std::fmt::Display;

use thiserror::Error;

pub struct Block {
    id: uuid::Uuid,
    content: Content,
    metadata: Metadata,
}

impl Block {
    pub fn new(id: uuid::Uuid, content: Content, metadata: Metadata) -> Self {
        Self { id, content, metadata }
    }
    pub fn id(&self) -> &uuid::Uuid {
        &self.id
    }
    pub fn content(&self) -> &Content {
        &self.content
    }
    pub fn metadata(&self) -> &Metadata {
        &self.metadata
    }
}

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

pub struct Metadata(String);

impl Metadata {
    pub fn new(raw: &str) -> Self {
        let trimmed = raw.trim();
        Self(trimmed.to_string())
    }
}

impl Display for Metadata {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

pub struct CreateBlockRequest {
    content: Content,
    metadata: Metadata,
}

impl CreateBlockRequest {
    pub fn new(content: Content, metadata: Metadata) -> Self {
        Self { content, metadata }
    }
    pub fn content(&self) -> &Content {
        &self.content
    }
    pub fn metadata(&self) -> &Metadata {
        &self.metadata
    }
}

#[derive(Debug, Error)]
pub enum CreateBlockError  {
    #[error(transparent)]
    Unknown(#[from] anyhow::Error),
}

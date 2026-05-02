use serde::Serializer;
use domain::models::block::{CreateBlockError, UpdateBlockError, DeleteBlockError};

#[derive(Debug)]
pub enum AppError {
    BlockNotFound(uuid::Uuid),
    StorageError(String),
    MetadataError(String),
    InternalError(String),
}

// Serialize as a flat string so the JS side always receives a plain string error message
impl serde::Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&self.to_string())
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::BlockNotFound(id) => write!(f, "Block not found: {}", id),
            Self::StorageError(s) => write!(f, "Storage error: {}", s),
            Self::MetadataError(s) => write!(f, "Metadata error: {}", s),
            Self::InternalError(s) => write!(f, "Internal error: {}", s),
        }
    }
}

impl std::error::Error for AppError {}

// Implement From conversions so ? operator works cleanly
impl From<String> for AppError {
    fn from(s: String) -> Self { AppError::InternalError(s) }
}
impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self { AppError::InternalError(e.to_string()) }
}
impl From<CreateBlockError> for AppError {
    fn from(e: CreateBlockError) -> Self { AppError::InternalError(e.to_string()) }
}
impl From<UpdateBlockError> for AppError {
    fn from(e: UpdateBlockError) -> Self { AppError::InternalError(e.to_string()) }
}
impl From<DeleteBlockError> for AppError {
    fn from(e: DeleteBlockError) -> Self {
        match e {
            DeleteBlockError::NotFound(id) => AppError::BlockNotFound(id),
            DeleteBlockError::Storage(err) => AppError::StorageError(format!("{:?}", err)),
            DeleteBlockError::Unknown(err) => AppError::InternalError(format!("{:?}", err)),
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;

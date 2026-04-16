use std::fmt::Display;
use uuid::Uuid;
pub use crate::models::block::schema::{Fields, Value};

#[derive(Clone, Debug)]
pub struct Metadata {
    id: Uuid,
    fields: Fields,
}

impl Display for Metadata {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.fields)
    }
}

impl Metadata {
    pub fn new(id: Uuid, fields: Fields) -> Self {
        Self { id, fields }
    }
    pub fn id(&self) -> &Uuid {
        &self.id
    }
    pub fn fields(&self) -> &Fields {
        &self.fields
    }
    pub fn is_empty(&self) -> bool {
        self.fields.is_empty()
    }
}

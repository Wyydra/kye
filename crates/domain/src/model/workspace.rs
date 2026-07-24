use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceMeta {
    pub id: Uuid,
    pub name: String,
}

impl WorkspaceMeta {
    pub fn new(id: Uuid, name: impl Into<String>) -> Self {
        Self {
            id,
            name: name.into(),
        }
    }
}

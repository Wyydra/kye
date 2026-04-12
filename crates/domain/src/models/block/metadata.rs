use std::{
    collections::BTreeMap,
    fmt::Display,
    ops::{Deref, DerefMut},
};

use uuid::Uuid;
use crate::models::block::type_def::FieldName;

#[derive(Clone, Debug)]
pub struct Metadata {
    id: Uuid,
    fields: Fields,
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

impl Display for Metadata {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "#Metadata({:?})", self.fields)
    }
}

#[derive(Debug, Clone)]
pub struct Fields(BTreeMap<FieldName, Value>);

impl Fields {
    pub fn new() -> Self {
        Self(BTreeMap::new())
    }
    pub fn insert(&mut self, name: FieldName, value: Value) {
        self.0.insert(name, value);
    }
}

impl Deref for Fields {
    type Target = BTreeMap<FieldName, Value>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Fields {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

#[derive(Clone, Debug)]
pub enum Value {
    None,
    Boolean(bool),
    Integer(i64),
    String(String),
    Object(Fields),
    Array(Vec<Value>),
}

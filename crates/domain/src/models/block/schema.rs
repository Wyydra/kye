use std::{collections::BTreeMap, sync::Arc, ops::{Deref, DerefMut}, fmt::Display};
use uuid::Uuid;

#[derive(Clone, Debug)]
pub enum Value {
    None,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
    Object(Fields),
    Array(Vec<Value>),
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
    pub fn satisfies(&self, definition: &TypeDefinition) -> bool {
        definition.matches(self)
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

impl Display for Fields {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{{")?;
        for (i, (key, value)) in self.0.iter().enumerate() {
            if i > 0 { write!(f, ", ")?; }
            write!(f, "{}: {}", key, value)?;
        }
        write!(f, "}}")
    }
}

impl Display for Value {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Value::None => write!(f, "null"),
            Value::Boolean(b) => write!(f, "{}", b),
            Value::Integer(i) => write!(f, "{}", i),
            Value::Float(fl) => write!(f, "{}", fl),
            Value::String(s) => write!(f, "\"{}\"", s),
            Value::Object(fields) => write!(f, "{}", fields),
            Value::Array(values) => {
                write!(f, "[")?;
                for (i, val) in values.iter().enumerate() {
                    if i > 0 { write!(f, ", ")?; }
                    write!(f, "{}", val)?;
                }
                write!(f, "]")
            }
        }
    }
}


#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TypeDefinition {
    pub fields: BTreeMap<FieldName, FieldType>,
}

impl TypeDefinition {
    pub fn new(fields: BTreeMap<FieldName, FieldType>) -> Self {
        Self { fields }
    }
    pub fn empty() -> Self {
        Self {
            fields: BTreeMap::new(),
        }
    }
    pub fn matches(&self, fields: &Fields) -> bool {
        for (name, field_type) in &self.fields {
            match fields.get(name) {
                Some(value) => {
                    if !field_type.matches_value(value) {
                        return false;
                    }
                }
                None => return false,
            }
        }
        true
    }
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct FieldName(String);

impl FieldName {
    pub fn new(name: &str) -> Self {
        Self(name.to_string())
    }
}

impl std::fmt::Display for FieldName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct TypeName(String);

impl TypeName {
    pub fn new(name: &str) -> Self {
        Self(name.to_string())
    }
}

impl std::fmt::Display for TypeName {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum FieldType {
    Boolean,
    Integer,
    Float,
    String,
    Record(TypeDefinition),
    List(Arc<FieldType>),
    Named(TypeName),
}

impl FieldType {
    pub fn matches_value(&self, value: &Value) -> bool {
        match (self, value) {
            (FieldType::Boolean, Value::Boolean(_)) => true,
            (FieldType::Integer, Value::Integer(_)) => true,
            (FieldType::Float, Value::Float(_)) => true,
            (FieldType::String, Value::String(_)) => true,
            (FieldType::Record(def), Value::Object(fields)) => def.matches(fields),
            (FieldType::List(inner), Value::Array(values)) => {
                values.iter().all(|v| inner.matches_value(v))
            }
            _ => false,
        }
    }
}

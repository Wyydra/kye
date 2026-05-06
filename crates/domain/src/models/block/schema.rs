use std::{collections::BTreeMap, sync::Arc, ops::{Deref, DerefMut}, fmt::Display};

use crate::models::block::type_registry::TypeRegistry;


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

impl Value {
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::String(s) => Some(s),
            _ => None,
        }
    }
}

impl PartialEq for Value {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Value::None, Value::None) => true,
            (Value::Boolean(a), Value::Boolean(b)) => a == b,
            (Value::Integer(a), Value::Integer(b)) => a == b,
            (Value::Float(a), Value::Float(b)) => a.to_bits() == b.to_bits(),
            (Value::String(a), Value::String(b)) => a == b,
            (Value::Object(a), Value::Object(b)) => a == b,
            (Value::Array(a), Value::Array(b)) => a == b,
            _ => false,
        }
    }
}

impl Eq for Value {}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Fields(BTreeMap<FieldName, Value>);

impl Fields {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn insert(&mut self, name: FieldName, value: Value) {
        self.0.insert(name, value);
    }

    pub fn satisfies(&self, definition: &TypeDefinition, registry: &TypeRegistry) -> bool {
        definition.matches(self, registry)
    }
}

impl Default for Fields {
    fn default() -> Self {
        Self(BTreeMap::new())
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
    pub layout: Option<View>,
}

impl TypeDefinition {
    pub fn new(
        fields: BTreeMap<FieldName, FieldType>, 
        layout: Option<View>,
    ) -> Self {
        Self { fields, layout }
    }
    
    pub fn empty() -> Self {
        Self { 
            fields: BTreeMap::new(), 
            layout: None,
        }
    }

    pub fn matches(&self, fields: &Fields, registry: &TypeRegistry) -> bool {
        for (name, field_type) in &self.fields {
            match fields.get(name) {
                Some(value) => {
                    if !field_type.matches_value(value, registry) {
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
    Markdown,
    Url,
    Color,
    BlockId,
    Record(TypeDefinition),
    List(Arc<FieldType>),
    Named(TypeName),
}

impl FieldType {
    pub fn matches_value(&self, value: &Value, registry: &TypeRegistry) -> bool {
        match (self, value) {
            (FieldType::Boolean, Value::Boolean(_)) => true,
            (FieldType::Integer, Value::Integer(_)) => true,
            (FieldType::Float, Value::Float(_)) => true,
            (FieldType::String, Value::String(_)) => true,
            (FieldType::Markdown, Value::String(_)) => true,
            (FieldType::Url, Value::String(_)) => true,
            (FieldType::Color, Value::String(_)) => true,
            (FieldType::BlockId, Value::String(_)) => true,
            (FieldType::Record(def), Value::Object(fields)) => def.matches(fields, registry),
            (FieldType::List(inner), Value::Array(values)) => {
                values.iter().all(|v| inner.matches_value(v, registry))
            }
            (FieldType::Named(type_name), Value::Object(fields)) => {
                registry
                    .get(type_name)
                    .map(|def| def.matches(fields, registry))
                    .unwrap_or(false)
            }
            _ => false,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct View {
    pub kind: ViewKind,
    pub props: BTreeMap<String, Value>,
    pub bindings: BTreeMap<String, FieldName>,
    pub actions: BTreeMap<String, Action>,
    pub slots: BTreeMap<String, View>,
    pub children: Vec<View>,
}

impl View {
    pub fn new(kind: ViewKind) -> Self {
        Self {
            kind,
            props: BTreeMap::new(),
            bindings: BTreeMap::new(),
            actions: BTreeMap::new(),
            slots: BTreeMap::new(),
            children: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ViewKind {
    Stack(LayoutDirection),
    Grid { columns: u32 },
    Component(String),
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum LayoutDirection {
    Vertical,
    Horizontal,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Action {
    UpdateField {
        field: FieldName,
        value: Value,
    },
    NavigateTo {
        block_id: String,
    },
}

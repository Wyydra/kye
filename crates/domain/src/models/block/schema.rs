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

    pub fn is_none(&self) -> bool {
        matches!(self, Value::None)
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
    pub fields: BTreeMap<FieldName, FieldSchema>,
    pub layout: Option<View>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FieldSchema {
    pub field_type: FieldType,
    pub required: bool,
    pub label: Option<String>,
    pub description: Option<String>,
}

impl FieldSchema {
    pub fn new(field_type: FieldType) -> Self {
        Self {
            field_type,
            required: true,
            label: None,
            description: None,
        }
    }

    pub fn optional(mut self) -> Self {
        self.required = false;
        self
    }

    pub fn with_label(mut self, label: &str) -> Self {
        self.label = Some(label.to_string());
        self
    }
}

impl TypeDefinition {
    pub fn new(fields: BTreeMap<FieldName, FieldSchema>, layout: Option<View>) -> Self {
        Self { fields, layout }
    }
    
    pub fn empty() -> Self {
        Self { 
            fields: BTreeMap::new(), 
            layout: None,
        }
    }

    pub fn validate(&self, fields: &Fields, registry: &TypeRegistry) -> ValidationResult {
        let mut errors = Vec::new();
        
        for (name, schema) in &self.fields {
            match fields.get(name) {
                Some(value) => {
                    if let Err(mut field_errors) = schema.field_type.validate_value(value, registry) {
                        for err in &mut field_errors {
                            err.path.insert(0, name.to_string());
                        }
                        errors.extend(field_errors);
                    }
                }
                None if schema.required => {
                    errors.push(TypeError {
                        path: vec![name.to_string()],
                        message: format!("Missing required field: {}", name),
                    });
                }
                _ => {}
            }
        }
        
        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }

    pub fn matches(&self, fields: &Fields, registry: &TypeRegistry) -> bool {
        self.validate(fields, registry).is_ok()
    }

    pub fn is_more_specific_than(&self, other: &Self, registry: &TypeRegistry) -> bool {
        // A type is more specific if it satisfies all requirements of 'other'
        // and adds more requirements or refines them.
        for (name, other_schema) in &other.fields {
            match self.fields.get(name) {
                Some(self_schema) => {
                    if !self_schema.field_type.is_assignable_to(&other_schema.field_type, registry) {
                        return false;
                    }
                    if other_schema.required && !self_schema.required {
                        return false;
                    }
                }
                None => {
                    if other_schema.required {
                        return false;
                    }
                }
            }
        }
        true
    }
}

pub type ValidationResult = Result<(), Vec<TypeError>>;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TypeError {
    pub path: Vec<String>,
    pub message: String,
}

#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct FieldName(String);

impl FieldName {
    pub fn new(name: &str) -> Self {
        Self(name.to_string())
    }
}

impl Display for FieldName {
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

impl Display for TypeName {
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
    Image,
    Link,
    Color,
    BlockId,
    Literal(Value),
    Union(Vec<FieldType>),
    Intersection(Vec<FieldType>),
    Record(TypeDefinition),
    List(Arc<FieldType>),
    Named(TypeName),
}

impl FieldType {
    pub fn validate_value(&self, value: &Value, registry: &TypeRegistry) -> ValidationResult {
        match (self, value) {
            (FieldType::Boolean, Value::Boolean(_)) => Ok(()),
            (FieldType::Integer, Value::Integer(_)) => Ok(()),
            (FieldType::Float, Value::Float(_)) => Ok(()),
            (FieldType::String, Value::String(_)) => Ok(()),
            (FieldType::Markdown, Value::String(_)) => Ok(()),
            (FieldType::Image, Value::String(_)) => Ok(()),
            (FieldType::Link, Value::String(_)) => Ok(()),
            (FieldType::Color, Value::String(_)) => Ok(()),
            (FieldType::BlockId, Value::String(_)) => Ok(()),
            
            (FieldType::Literal(expected), actual) => {
                if expected == actual {
                    Ok(())
                } else {
                    Err(vec![TypeError {
                        path: vec![],
                        message: format!("Expected literal {}, found {}", expected, actual),
                    }])
                }
            }

            (FieldType::Union(types), val) => {
                let mut errors = Vec::new();
                for t in types {
                    match t.validate_value(val, registry) {
                        Ok(_) => return Ok(()),
                        Err(e) => errors.extend(e),
                    }
                }
                Err(vec![TypeError {
                    path: vec![],
                    message: format!("Value does not match any type in union. Errors: {:?}", errors),
                }])
            }

            (FieldType::Intersection(types), val) => {
                let mut errors = Vec::new();
                for t in types {
                    if let Err(e) = t.validate_value(val, registry) {
                        errors.extend(e);
                    }
                }
                if errors.is_empty() { Ok(()) } else { Err(errors) }
            }

            (FieldType::Record(def), Value::Object(fields)) => def.validate(fields, registry),
            
            (FieldType::List(inner), Value::Array(values)) => {
                let mut errors = Vec::new();
                for (i, val) in values.iter().enumerate() {
                    if let Err(mut errs) = inner.validate_value(val, registry) {
                        for e in &mut errs {
                            e.path.insert(0, i.to_string());
                        }
                        errors.extend(errs);
                    }
                }
                if errors.is_empty() { Ok(()) } else { Err(errors) }
            }

            (FieldType::Named(type_name), Value::Object(fields)) => {
                registry
                    .get(type_name)
                    .map(|def| def.validate(fields, registry))
                    .unwrap_or(Err(vec![TypeError {
                        path: vec![],
                        message: format!("Type not found: {}", type_name),
                    }]))
            }
            
            (expected, actual) => Err(vec![TypeError {
                path: vec![],
                message: format!("Type mismatch: expected {:?}, found {}", expected, actual),
            }]),
        }
    }

    pub fn is_assignable_to(&self, other: &Self, registry: &TypeRegistry) -> bool {
        if self == other {
            return true;
        }

        match (self, other) {
            // Specialized strings are assignable to String
            (FieldType::Markdown, FieldType::String) => true,
            (FieldType::Image, FieldType::String) => true,
            (FieldType::Link, FieldType::String) => true,
            
            (FieldType::Record(a), FieldType::Record(b)) => a.is_more_specific_than(b, registry),
            
            (FieldType::Named(a_name), FieldType::Named(b_name)) => {
                if a_name == b_name { return true; }
                let a_def = registry.get(a_name);
                let b_def = registry.get(b_name);
                match (a_def, b_def) {
                    (Some(a), Some(b)) => a.is_more_specific_than(b, registry),
                    _ => false,
                }
            }
            
            (FieldType::Named(name), FieldType::Record(other_rec)) => {
                registry.get(name).map(|def| def.is_more_specific_than(other_rec, registry)).unwrap_or(false)
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

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::sync::Arc;
use domain::models::block::schema::{
    FieldName, FieldType, TypeDefinition, View, ViewKind,
    LayoutDirection, Action, Value, FieldSchema
};

#[derive(Deserialize, Serialize)]
pub struct TypeDefinitionDto {
    pub fields: BTreeMap<String, FieldSchemaDto>,
    pub layout: Option<ViewDto>,
}

#[derive(Deserialize, Serialize)]
pub struct FieldSchemaDto {
    #[serde(rename = "type")]
    pub field_type: FieldTypeDto,
    #[serde(default = "default_true")]
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

fn default_true() -> bool { true }

#[derive(Deserialize, Serialize)]
#[serde(tag = "kind", content = "data", rename_all = "lowercase")]
pub enum FieldTypeDto {
    Boolean,
    Integer,
    Float,
    String,
    Markdown,
    Image,
    Link,
    Color,
    BlockId,
    Literal(ValueDto),
    Union(Vec<FieldTypeDto>),
    Intersection(Vec<FieldTypeDto>),
    Record(TypeDefinitionDto),
    List(Box<FieldTypeDto>),
    Named(String),
}

#[derive(Deserialize, Serialize)]
pub struct ViewDto {
    #[serde(rename = "type")]
    pub kind: String,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<LayoutDirectionDto>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub columns: Option<u32>,
    
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub bindings: BTreeMap<String, String>,
    
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub props: BTreeMap<String, ValueDto>,
    
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub actions: BTreeMap<String, ActionDto>,
    
    #[serde(skip_serializing_if = "BTreeMap::is_empty", default)]
    pub slots: BTreeMap<String, ViewDto>,
    
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub children: Vec<ViewDto>,
}

#[derive(Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LayoutDirectionDto {
    Vertical,
    Horizontal,
}

#[derive(Deserialize, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActionDto {
    UpdateField {
        field: String,
        value: ValueDto,
    },
    NavigateTo {
        block_id: String,
    },
}

#[derive(Deserialize, Serialize)]
#[serde(untagged)]
pub enum ValueDto {
    None,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
    Array(Vec<ValueDto>),
    Object(BTreeMap<String, ValueDto>),
}


impl TypeDefinitionDto {
    pub fn to_domain(self) -> TypeDefinition {
        let mut fields = BTreeMap::new();
        for (name, schema) in self.fields {
            fields.insert(FieldName::new(&name), schema.to_domain());
        }
        TypeDefinition {
            fields,
            layout: self.layout.map(|l| l.to_domain()),
        }
    }

    pub fn from_domain(definition: &TypeDefinition) -> Self {
        let mut fields = BTreeMap::new();
        for (name, schema) in &definition.fields {
            fields.insert(name.to_string(), FieldSchemaDto::from_domain(schema));
        }
        Self {
            fields,
            layout: definition.layout.as_ref().map(ViewDto::from_domain),
        }
    }
}

impl FieldSchemaDto {
    pub fn to_domain(self) -> FieldSchema {
        FieldSchema {
            field_type: self.field_type.to_domain(),
            required: self.required,
            label: self.label,
            description: self.description,
        }
    }

    pub fn from_domain(schema: &FieldSchema) -> Self {
        Self {
            field_type: FieldTypeDto::from_domain(&schema.field_type),
            required: schema.required,
            label: schema.label.clone(),
            description: schema.description.clone(),
        }
    }
}


impl FieldTypeDto {
    pub fn to_domain(self) -> FieldType {
        match self {
            FieldTypeDto::Boolean => FieldType::Boolean,
            FieldTypeDto::Integer => FieldType::Integer,
            FieldTypeDto::Float => FieldType::Float,
            FieldTypeDto::String => FieldType::String,
            FieldTypeDto::Markdown => FieldType::Markdown,
            FieldTypeDto::Image => FieldType::Image,
            FieldTypeDto::Link => FieldType::Link,
            FieldTypeDto::Color => FieldType::Color,
            FieldTypeDto::BlockId => FieldType::BlockId,
            FieldTypeDto::Literal(v) => FieldType::Literal(v.to_domain()),
            FieldTypeDto::Union(types) => FieldType::Union(types.into_iter().map(|t| t.to_domain()).collect()),
            FieldTypeDto::Intersection(types) => FieldType::Intersection(types.into_iter().map(|t| t.to_domain()).collect()),
            FieldTypeDto::Record(def) => FieldType::Record(def.to_domain()),
            FieldTypeDto::List(inner) => FieldType::List(Arc::new(inner.to_domain())),
            FieldTypeDto::Named(name) => FieldType::Named(domain::models::block::schema::TypeName::new(&name)),
        }
    }

    pub fn from_domain(ftype: &FieldType) -> Self {
        match ftype {
            FieldType::Boolean => FieldTypeDto::Boolean,
            FieldType::Integer => FieldTypeDto::Integer,
            FieldType::Float => FieldTypeDto::Float,
            FieldType::String => FieldTypeDto::String,
            FieldType::Markdown => FieldTypeDto::Markdown,
            FieldType::Image => FieldTypeDto::Image,
            FieldType::Link => FieldTypeDto::Link,
            FieldType::Color => FieldTypeDto::Color,
            FieldType::BlockId => FieldTypeDto::BlockId,
            FieldType::Literal(v) => FieldTypeDto::Literal(ValueDto::from_domain(v)),
            FieldType::Union(types) => FieldTypeDto::Union(types.iter().map(FieldTypeDto::from_domain).collect()),
            FieldType::Intersection(types) => FieldTypeDto::Intersection(types.iter().map(FieldTypeDto::from_domain).collect()),
            FieldType::Record(def) => FieldTypeDto::Record(TypeDefinitionDto::from_domain(def)),
            FieldType::List(inner) => FieldTypeDto::List(Box::new(FieldTypeDto::from_domain(inner))),
            FieldType::Named(name) => FieldTypeDto::Named(name.to_string()),
        }
    }
}

impl ViewDto {
    pub fn to_domain(self) -> View {
        let kind = match self.kind.as_str() {
            "stack" => ViewKind::Stack(self.direction.map(|d| d.to_domain()).unwrap_or(LayoutDirection::Vertical)),
            "grid" => ViewKind::Grid { columns: self.columns.unwrap_or(1) },
            _ => ViewKind::Component(self.kind),
        };

        let mut bindings = BTreeMap::new();
        for (k, v) in self.bindings {
            bindings.insert(k, FieldName::new(&v));
        }
        
        let mut props = BTreeMap::new();
        for (k, v) in self.props {
            props.insert(k, v.to_domain());
        }
        
        let mut slots = BTreeMap::new();
        for (k, v) in self.slots {
            slots.insert(k, v.to_domain());
        }

        let mut actions = BTreeMap::new();
        for (k, v) in self.actions {
            actions.insert(k, v.to_domain());
        }

        let mut children = Vec::new();
        for c in self.children {
            children.push(c.to_domain());
        }

        View {
            kind,
            props,
            bindings,
            actions,
            slots,
            children,
        }
    }

    pub fn from_domain(view: &View) -> Self {
        let (kind, direction, columns) = match &view.kind {
            ViewKind::Stack(d) => ("stack".to_string(), Some(LayoutDirectionDto::from_domain(d)), None),
            ViewKind::Grid { columns } => ("grid".to_string(), None, Some(*columns)),
            ViewKind::Component(name) => (name.clone(), None, None),
        };

        let mut bindings = BTreeMap::new();
        for (k, v) in &view.bindings {
            bindings.insert(k.clone(), v.to_string());
        }

        let mut props = BTreeMap::new();
        for (k, v) in &view.props {
            props.insert(k.clone(), ValueDto::from_domain(v));
        }

        let mut actions = BTreeMap::new();
        for (k, v) in &view.actions {
            actions.insert(k.clone(), ActionDto::from_domain(v));
        }

        let mut slots = BTreeMap::new();
        for (k, v) in &view.slots {
            slots.insert(k.clone(), ViewDto::from_domain(v));
        }

        let mut children = Vec::new();
        for c in &view.children {
            children.push(ViewDto::from_domain(c));
        }

        Self {
            kind,
            direction,
            columns,
            bindings,
            props,
            actions,
            slots,
            children,
        }
    }
}

impl LayoutDirectionDto {
    pub fn to_domain(self) -> LayoutDirection {
        match self {
            LayoutDirectionDto::Vertical => LayoutDirection::Vertical,
            LayoutDirectionDto::Horizontal => LayoutDirection::Horizontal,
        }
    }

    pub fn from_domain(direction: &LayoutDirection) -> Self {
        match direction {
            LayoutDirection::Vertical => LayoutDirectionDto::Vertical,
            LayoutDirection::Horizontal => LayoutDirectionDto::Horizontal,
        }
    }
}

impl ActionDto {
    pub fn to_domain(self) -> Action {
        match self {
            ActionDto::UpdateField { field, value } => Action::UpdateField {
                field: FieldName::new(&field),
                value: value.to_domain(),
            },
            ActionDto::NavigateTo { block_id } => Action::NavigateTo {
                block_id,
            },
        }
    }

    pub fn from_domain(action: &Action) -> Self {
        match action {
            Action::UpdateField { field, value } => ActionDto::UpdateField {
                field: field.to_string(),
                value: ValueDto::from_domain(value),
            },
            Action::NavigateTo { block_id } => ActionDto::NavigateTo {
                block_id: block_id.clone(),
            },
        }
    }
}

impl ValueDto {
    pub fn to_domain(self) -> Value {
        match self {
            ValueDto::None => Value::None,
            ValueDto::Boolean(b) => Value::Boolean(b),
            ValueDto::Integer(i) => Value::Integer(i),
            ValueDto::Float(f) => Value::Float(f),
            ValueDto::String(s) => Value::String(s),
            ValueDto::Array(arr) => Value::Array(arr.into_iter().map(|v| v.to_domain()).collect()),
            ValueDto::Object(map) => {
                let mut fields = domain::models::block::schema::Fields::new();
                for (k, v) in map {
                    fields.insert(FieldName::new(&k), v.to_domain());
                }
                Value::Object(fields)
            }
        }
    }

    pub fn from_domain(value: &Value) -> Self {
        match value {
            Value::None => ValueDto::None,
            Value::Boolean(b) => ValueDto::Boolean(*b),
            Value::Integer(i) => ValueDto::Integer(*i),
            Value::Float(f) => ValueDto::Float(*f),
            Value::String(s) => ValueDto::String(s.clone()),
            Value::Array(arr) => ValueDto::Array(arr.iter().map(ValueDto::from_domain).collect()),
            Value::Object(fields) => {
                let mut map = BTreeMap::new();
                for (k, v) in fields.iter() {
                    map.insert(k.to_string(), ValueDto::from_domain(v));
                }
                ValueDto::Object(map)
            }
        }
    }
}

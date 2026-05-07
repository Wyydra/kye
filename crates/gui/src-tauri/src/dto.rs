use serde::{Deserialize, Serialize};
use uuid::Uuid;
use domain::models::block::schema::{FieldType, View, ViewKind, Value, Action, FieldSchema};
use domain::ports::TypeInspector;
use std::collections::BTreeMap;

use crate::state::AppService;

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceDto {
    pub name: String,
    pub blocks: Vec<BlockDto>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockDto {
    pub id: Uuid,
    pub shapes: Vec<String>,
    pub fields: BTreeMap<String, serde_json::Value>,
    pub primary_shape: String,
}

impl WorkspaceDto {
    pub fn from_domain(w: &domain::models::workspace::Workspace, service: &AppService) -> Self {
        Self {
            name: w.name().to_string(),
            blocks: w.blocks().iter().map(|b| (b, service).into()).collect(),
        }
    }
}

impl From<(&domain::models::block::Block, &AppService)> for BlockDto {
    fn from((b, service): (&domain::models::block::Block, &AppService)) -> Self {
        let mut fields = BTreeMap::new();
        for (name, val) in b.fields().iter() {
            fields.insert(name.to_string(), value_to_json(val.clone()));
        }

        let shapes = service.identify_block_shapes(b.fields());
        let primary_shape = shapes.get(0).cloned().unwrap_or_else(|| "text".to_string());

        Self {
            id: *b.id(),
            shapes,
            fields,
            primary_shape,
        }
    }
}

#[derive(Serialize)]
pub struct FieldDefinitionDto {
    pub name: String,
    pub field_type: String,
    pub required: bool,
    pub label: Option<String>,
    pub description: Option<String>,
}

#[derive(Serialize)]
pub struct TemplateDto {
    pub name: String,
    pub fields: Vec<FieldDefinitionDto>,
    pub layout: Option<WidgetDto>,
}

impl FieldDefinitionDto {
    pub fn from_domain(name: String, schema: &FieldSchema) -> Self {
        Self {
            name,
            field_type: field_type_to_str(&schema.field_type),
            required: schema.required,
            label: schema.label.clone(),
            description: schema.description.clone(),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WidgetDto {
    #[serde(rename = "type")]
    pub kind: String,
    pub props: BTreeMap<String, serde_json::Value>,
    pub bindings: BTreeMap<String, String>,
    pub actions: BTreeMap<String, ActionDto>,
    pub slots: BTreeMap<String, WidgetDto>,
    pub children: Vec<WidgetDto>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActionDto {
    UpdateField {
        field: String,
        value: serde_json::Value,
    },
    NavigateTo {
        block_id: String,
    },
}

pub fn field_type_to_str(ft: &FieldType) -> String {
    match ft {
        FieldType::Boolean => "Boolean".to_string(),
        FieldType::Integer => "Integer".to_string(),
        FieldType::Float => "Float".to_string(),
        FieldType::String => "String".to_string(),
        FieldType::Markdown => "Markdown".to_string(),
        FieldType::Image => "Image".to_string(),
        FieldType::Link => "Link".to_string(),
        FieldType::Color => "Color".to_string(),
        FieldType::BlockId => "BlockId".to_string(),
        FieldType::Literal(v) => format!("Literal:{}", v),
        FieldType::Union(_) => "Union".to_string(),
        FieldType::Intersection(_) => "Intersection".to_string(),
        FieldType::Record(_) => "Record".to_string(),
        FieldType::List(inner) => format!("List<{}>", field_type_to_str(inner)),
        FieldType::Named(name) => name.to_string(),
    }
}

impl From<View> for WidgetDto {
    fn from(view: View) -> Self {
        let kind = match &view.kind {
            ViewKind::Stack(_) => "stack".to_string(),
            ViewKind::Grid { .. } => "grid".to_string(),
            ViewKind::Component(name) => name.clone(),
        };

        let mut props = BTreeMap::new();
        
        // Add kind-specific props
        match &view.kind {
            ViewKind::Stack(dir) => {
                props.insert("direction".to_string(), serde_json::Value::String(format!("{:?}", dir).to_lowercase()));
            }
            ViewKind::Grid { columns } => {
                props.insert("columns".to_string(), serde_json::Value::Number((*columns).into()));
            }
            _ => {}
        }

        // Add general props
        for (k, v) in view.props {
            props.insert(k, value_to_json(v));
        }

        let mut bindings = BTreeMap::new();
        for (k, v) in view.bindings {
            bindings.insert(k, v.to_string());
        }

        let mut actions = BTreeMap::new();
        for (k, v) in view.actions {
            actions.insert(k, v.into());
        }
        
        let mut slots = BTreeMap::new();
        for (k, v) in view.slots {
            slots.insert(k, v.into());
        }

        WidgetDto {
            kind,
            props,
            bindings,
            actions,
            slots,
            children: view.children.into_iter().map(|c| c.into()).collect(),
        }
    }
}

fn value_to_json(v: Value) -> serde_json::Value {
    match v {
        Value::None => serde_json::Value::Null,
        Value::Boolean(b) => serde_json::Value::Bool(b),
        Value::Integer(i) => serde_json::Value::Number(i.into()),
        Value::Float(f) => serde_json::Value::from(f),
        Value::String(s) => serde_json::Value::String(s),
        Value::Array(arr) => serde_json::Value::Array(arr.into_iter().map(value_to_json).collect()),
        Value::Object(fields) => {
            let mut map = serde_json::Map::new();
            for (k, val) in fields.iter() {
                map.insert(k.to_string(), value_to_json(val.clone()));
            }
            serde_json::Value::Object(map)
        }
    }
}

impl From<Action> for ActionDto {
    fn from(action: Action) -> Self {
        match action {
            Action::UpdateField { field, value } => ActionDto::UpdateField {
                field: field.to_string(),
                value: value_to_json(value),
            },
            Action::NavigateTo { block_id } => ActionDto::NavigateTo {
                block_id,
            },
        }
    }
}

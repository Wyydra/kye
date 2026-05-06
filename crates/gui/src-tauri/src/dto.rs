use serde::{Deserialize, Serialize};
use uuid::Uuid;
use domain::models::block::schema::FieldType;
use domain::ports::TypeInspector;

use crate::state::AppService;

#[derive(Debug, Serialize, Deserialize)]
pub struct WorkspaceDto {
    pub name: String,
    pub blocks: Vec<BlockDto>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BlockDto {
    pub id: Uuid,
    pub content: String,
    pub metadata: String,
    pub shapes: Vec<String>,
    pub source: String,
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
        let source = service.render_block_source(b);

        Self {
            id: *b.id(),
            content: b.fields().get(&domain::models::block::schema::FieldName::new("body")).and_then(|v| v.as_str()).unwrap_or_default().to_string(),
            metadata: infra::metadata::render_json(b.id(), b.fields()),
            shapes: service.identify_block_shapes(b.fields()),
            source,
        }
    }
}

#[derive(Serialize)]
pub struct FieldDefinitionDto {
    pub name: String,
    pub field_type: String,
}

#[derive(Serialize)]
pub struct TemplateDto {
    pub name: String,
    pub fields: Vec<FieldDefinitionDto>,
    pub layout: Option<WidgetDto>,
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum WidgetDto {
    Stack {
        direction: String,
        children: Vec<WidgetDto>,
    },
    Grid {
        columns: u32,
        children: Vec<WidgetDto>,
    },
    Markdown {
        bind: Option<String>,
    },
    Image {
        bind: Option<String>,
    },
    Text {
        value: String,
        style: Option<String>,
    },
    Button {
        label: String,
        on_click: Option<ActionDto>,
    },
    FlipCard {
        front: Box<WidgetDto>,
        back: Box<WidgetDto>,
    },
    Link {
        label: String,
        bind: Option<String>,
    },
}

#[derive(Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActionDto {
    UpdateField {
        field: String,
        value: serde_json::Value,
    },
}

pub fn field_type_to_str(ft: &FieldType) -> String {
    match ft {
        FieldType::Boolean => "Boolean".to_string(),
        FieldType::Integer => "Integer".to_string(),
        FieldType::Float => "Float".to_string(),
        FieldType::String => "String".to_string(),
        FieldType::Markdown => "Markdown".to_string(),
        FieldType::Url => "Url".to_string(),
        FieldType::Color => "Color".to_string(),
        FieldType::BlockId => "BlockId".to_string(),
        FieldType::Record(_) => "Record".to_string(),
        FieldType::List(_) => "List".to_string(),
        FieldType::Named(name) => format!("Named:{}", name),
    }
}

impl From<domain::models::block::schema::InterfaceIntent> for WidgetDto {
    fn from(intent: domain::models::block::schema::InterfaceIntent) -> Self {
        use domain::models::block::schema::InterfaceIntent::*;
        match intent {
            Stack { direction, children } => WidgetDto::Stack {
                direction: format!("{:?}", direction).to_lowercase(),
                children: children.into_iter().map(|c| c.into()).collect(),
            },
            Grid { columns, children } => WidgetDto::Grid {
                columns,
                children: children.into_iter().map(|c| c.into()).collect(),
            },
            Markdown { bind } => WidgetDto::Markdown {
                bind: bind.map(|b| b.to_string()),
            },
            Image { bind } => WidgetDto::Image {
                bind: bind.map(|b| b.to_string()),
            },
            Text { value, style } => WidgetDto::Text { value, style },
            Button { label, on_click } => WidgetDto::Button {
                label,
                on_click: on_click.map(|o| o.into()),
            },
            FlipCard { front, back } => WidgetDto::FlipCard {
                front: Box::new((*front).into()),
                back: Box::new((*back).into()),
            },
            Link { label, bind } => WidgetDto::Link {
                label,
                bind: bind.map(|b| b.to_string()),
            },
        }
    }
}

impl From<domain::models::block::schema::InteractionEffect> for ActionDto {
    fn from(effect: domain::models::block::schema::InteractionEffect) -> Self {
        use domain::models::block::schema::InteractionEffect::*;
        match effect {
            UpdateField { field, value } => ActionDto::UpdateField {
                field: field.to_string(),
                value: match value {
                    domain::models::block::schema::Value::None => serde_json::Value::Null,
                    domain::models::block::schema::Value::Boolean(b) => serde_json::Value::Bool(b),
                    domain::models::block::schema::Value::Integer(i) => serde_json::Value::Number(i.into()),
                    domain::models::block::schema::Value::Float(f) => serde_json::Value::from(f),
                    domain::models::block::schema::Value::String(s) => serde_json::Value::String(s),
                    _ => serde_json::Value::Null, // Simplified for now
                },
            },
            NavigateTo { .. } => ActionDto::UpdateField { 
                field: "error".to_string(), 
                value: serde_json::Value::String("Navigation not implemented".to_string()) 
            },
        }
    }
}

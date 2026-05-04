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
        Self {
            id: *b.id(),
            content: b.content().to_string(),
            metadata: infra::metadata::render_json(b.id(), b.metadata()),
            shapes: service.identify_block_shapes(b.metadata().fields()),
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
}

pub fn field_type_to_str(ft: &FieldType) -> String {
    match ft {
        FieldType::Boolean => "Boolean".to_string(),
        FieldType::Integer => "Integer".to_string(),
        FieldType::Float => "Float".to_string(),
        FieldType::String => "String".to_string(),
        FieldType::Record(_) => "Record".to_string(),
        FieldType::List(_) => "List".to_string(),
        FieldType::Named(name) => format!("Named:{}", name),
    }
}

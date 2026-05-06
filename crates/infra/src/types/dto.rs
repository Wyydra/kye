use serde::Deserialize;
use std::collections::BTreeMap;
use domain::models::block::schema::{
    FieldName, FieldType, TypeDefinition, InterfaceIntent, 
    LayoutDirection, InteractionEffect, Value
};

#[derive(Deserialize)]
pub struct TypeDefinitionDto {
    pub fields: BTreeMap<String, FieldTypeDto>,
    pub layout: Option<InterfaceIntentDto>,
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum FieldTypeDto {
    Boolean,
    Integer,
    Float,
    String,
    Markdown,
    Url,
    Color,
    BlockId,
    // For recursive or named types, we might need more logic
    // but let's stick to the basics first.
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum InterfaceIntentDto {
    Stack {
        direction: LayoutDirectionDto,
        children: Vec<InterfaceIntentDto>,
    },
    Grid {
        columns: u32,
        children: Vec<InterfaceIntentDto>,
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
        on_click: Option<InteractionEffectDto>,
    },
    FlipCard {
        front: Box<InterfaceIntentDto>,
        back: Box<InterfaceIntentDto>,
    },
    Link {
        label: String,
        bind: Option<String>,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LayoutDirectionDto {
    Vertical,
    Horizontal,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InteractionEffectDto {
    UpdateField {
        field: String,
        value: ValueDto, // We need a Value DTO since Value is in Domain without Serde
    },
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum ValueDto {
    None,
    Boolean(bool),
    Integer(i64),
    Float(f64),
    String(String),
}


impl TypeDefinitionDto {
    pub fn to_domain(self) -> TypeDefinition {
        let mut fields = BTreeMap::new();
        for (name, ftype) in self.fields {
            fields.insert(FieldName::new(&name), ftype.to_domain());
        }
        TypeDefinition::new(
            fields,
            self.layout.map(|l| l.to_domain())
        )
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
            FieldTypeDto::Url => FieldType::Url,
            FieldTypeDto::Color => FieldType::Color,
            FieldTypeDto::BlockId => FieldType::BlockId,
        }
    }
}

impl InterfaceIntentDto {
    pub fn to_domain(self) -> InterfaceIntent {
        match self {
            InterfaceIntentDto::Stack { direction, children } => InterfaceIntent::Stack {
                direction: direction.to_domain(),
                children: children.into_iter().map(|c| c.to_domain()).collect(),
            },
            InterfaceIntentDto::Grid { columns, children } => InterfaceIntent::Grid {
                columns,
                children: children.into_iter().map(|c| c.to_domain()).collect(),
            },
            InterfaceIntentDto::Markdown { bind } => InterfaceIntent::Markdown {
                bind: bind.map(|b| FieldName::new(&b)),
            },
            InterfaceIntentDto::Image { bind } => InterfaceIntent::Image {
                bind: bind.map(|b| FieldName::new(&b)),
            },
            InterfaceIntentDto::Text { value, style } => InterfaceIntent::Text { value, style },
            InterfaceIntentDto::Button { label, on_click } => InterfaceIntent::Button {
                label,
                on_click: on_click.map(|o| o.to_domain()),
            },
            InterfaceIntentDto::Link { label, bind } => InterfaceIntent::Link {
                label,
                bind: bind.map(|b| FieldName::new(&b)),
            },
            InterfaceIntentDto::FlipCard { front, back } => InterfaceIntent::FlipCard {
                front: Box::new(front.to_domain()),
                back: Box::new(back.to_domain()),
            },
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
}

impl InteractionEffectDto {
    pub fn to_domain(self) -> InteractionEffect {
        match self {
            InteractionEffectDto::UpdateField { field, value } => InteractionEffect::UpdateField {
                field: FieldName::new(&field),
                value: value.to_domain(),
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
        }
    }
}

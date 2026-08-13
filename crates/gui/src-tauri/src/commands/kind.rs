use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::primitives::{Kind, PropKey};
use domain::schema::{Constraint, KindDef, PropDef, ValueType};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", content = "config")]
pub enum ValueTypeDto {
    Bool,
    Int,
    Float,
    Text,
    Rich,
    Ref,
    RefTo { kind: String },
    OneOf { options: Vec<String> },
    Array { item_type: Box<ValueTypeDto> },
    Optional { inner_type: Box<ValueTypeDto> },
    Date,
    DateTime,
    Color,
}

impl From<&ValueType> for ValueTypeDto {
    fn from(vt: &ValueType) -> Self {
        match vt {
            ValueType::Bool => ValueTypeDto::Bool,
            ValueType::Int => ValueTypeDto::Int,
            ValueType::Float => ValueTypeDto::Float,
            ValueType::Text => ValueTypeDto::Text,
            ValueType::Rich => ValueTypeDto::Rich,
            ValueType::Ref => ValueTypeDto::Ref,
            ValueType::RefTo(k) => ValueTypeDto::RefTo {
                kind: k.as_str().to_string(),
            },
            ValueType::OneOf(opts) => ValueTypeDto::OneOf {
                options: opts.clone(),
            },
            ValueType::Array(inner) => ValueTypeDto::Array {
                item_type: Box::new(ValueTypeDto::from(inner.as_ref())),
            },
            ValueType::Optional(inner) => ValueTypeDto::Optional {
                inner_type: Box::new(ValueTypeDto::from(inner.as_ref())),
            },
            ValueType::Date => ValueTypeDto::Date,
            ValueType::DateTime => ValueTypeDto::DateTime,
            ValueType::Color => ValueTypeDto::Color,
        }
    }
}

impl From<ValueTypeDto> for ValueType {
    fn from(dto: ValueTypeDto) -> Self {
        match dto {
            ValueTypeDto::Bool => ValueType::Bool,
            ValueTypeDto::Int => ValueType::Int,
            ValueTypeDto::Float => ValueType::Float,
            ValueTypeDto::Text => ValueType::Text,
            ValueTypeDto::Rich => ValueType::Rich,
            ValueTypeDto::Ref => ValueType::Ref,
            ValueTypeDto::RefTo { kind } => ValueType::RefTo(Kind::from(kind)),
            ValueTypeDto::OneOf { options } => ValueType::OneOf(options),
            ValueTypeDto::Array { item_type } => ValueType::Array(Box::new((*item_type).into())),
            ValueTypeDto::Optional { inner_type } => {
                ValueType::Optional(Box::new((*inner_type).into()))
            }
            ValueTypeDto::Date => ValueType::Date,
            ValueTypeDto::DateTime => ValueType::DateTime,
            ValueTypeDto::Color => ValueType::Color,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PropDefDto {
    pub value_type: ValueTypeDto,
    pub required: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl From<&PropDef> for PropDefDto {
    fn from(p: &PropDef) -> Self {
        Self {
            value_type: ValueTypeDto::from(&p.value_type),
            required: p.required,
            label: p.label.clone(),
            description: p.description.clone(),
        }
    }
}

impl From<PropDefDto> for PropDef {
    fn from(dto: PropDefDto) -> Self {
        let mut prop = PropDef::new(dto.value_type.into());
        if !dto.required {
            prop = prop.optional();
        }
        if let Some(lbl) = dto.label {
            prop = prop.with_label(&lbl);
        }
        if let Some(desc) = dto.description {
            prop = prop.with_description(&desc);
        }
        prop
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", content = "config")]
pub enum ConstraintDto {
    AllowedChildKinds { kinds: Vec<String> },
    AllowedParentKinds { kinds: Vec<String> },
    ConnectionSourceKinds { kinds: Vec<String> },
    ConnectionTargetKinds { kinds: Vec<String> },
    MaxChildren { max: usize },
}

impl From<&Constraint> for ConstraintDto {
    fn from(c: &Constraint) -> Self {
        match c {
            Constraint::AllowedChildKinds(kinds) => ConstraintDto::AllowedChildKinds {
                kinds: kinds.iter().map(|k| k.as_str().to_string()).collect(),
            },
            Constraint::AllowedParentKinds(kinds) => ConstraintDto::AllowedParentKinds {
                kinds: kinds.iter().map(|k| k.as_str().to_string()).collect(),
            },
            Constraint::ConnectionSourceKinds(kinds) => ConstraintDto::ConnectionSourceKinds {
                kinds: kinds.iter().map(|k| k.as_str().to_string()).collect(),
            },
            Constraint::ConnectionTargetKinds(kinds) => ConstraintDto::ConnectionTargetKinds {
                kinds: kinds.iter().map(|k| k.as_str().to_string()).collect(),
            },
            Constraint::MaxChildren(max) => ConstraintDto::MaxChildren { max: *max },
        }
    }
}

impl From<ConstraintDto> for Constraint {
    fn from(dto: ConstraintDto) -> Self {
        match dto {
            ConstraintDto::AllowedChildKinds { kinds } => {
                Constraint::AllowedChildKinds(kinds.into_iter().map(Kind::from).collect())
            }
            ConstraintDto::AllowedParentKinds { kinds } => {
                Constraint::AllowedParentKinds(kinds.into_iter().map(Kind::from).collect())
            }
            ConstraintDto::ConnectionSourceKinds { kinds } => {
                Constraint::ConnectionSourceKinds(kinds.into_iter().map(Kind::from).collect())
            }
            ConstraintDto::ConnectionTargetKinds { kinds } => {
                Constraint::ConnectionTargetKinds(kinds.into_iter().map(Kind::from).collect())
            }
            ConstraintDto::MaxChildren { max } => Constraint::MaxChildren(max),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KindDefDto {
    pub label: String,
    pub icon: String,
    pub title_prop: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view: Option<crate::dto::ViewDefDto>,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub props: HashMap<String, PropDefDto>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub constraints: Vec<ConstraintDto>,
}

impl From<&KindDef> for KindDefDto {
    fn from(def: &KindDef) -> Self {
        let mut props = HashMap::new();
        for (k, p) in &def.props {
            props.insert(k.as_str().to_string(), PropDefDto::from(p));
        }
        let constraints = def.constraints.iter().map(ConstraintDto::from).collect();

        Self {
            label: def.label.clone(),
            icon: def.icon.clone().unwrap_or_default(),
            title_prop: def.title_prop.as_str().to_string(),
            view: def.view.as_ref().map(crate::dto::ViewDefDto::from),
            props,
            constraints,
        }
    }
}

impl From<KindDefDto> for KindDef {
    fn from(dto: KindDefDto) -> Self {
        let mut def = KindDef::new(&dto.label, &dto.title_prop).with_icon(&dto.icon);
        if let Some(v) = dto.view {
            def = def.with_view(v.into());
        }
        for (k, p) in dto.props {
            def = def.with_prop(PropKey::from(k), PropDef::from(p));
        }
        for c in dto.constraints {
            def = def.with_constraint(Constraint::from(c));
        }
        def
    }
}

#[tauri::command]
pub fn get_kinds(state: tauri::State<'_, AppState>) -> AppResult<Vec<(String, KindDefDto)>> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let kinds = service.get_all_kinds()?;
    Ok(kinds
        .into_iter()
        .map(|(k, d)| (k.as_str().to_string(), KindDefDto::from(&d)))
        .collect())
}

#[tauri::command]
pub fn register_kind(
    kind: String,
    def: KindDefDto,
    state: tauri::State<'_, AppState>,
) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    service.register_kind(Kind::from(kind.as_str()), def.into())?;
    Ok(())
}

#[tauri::command]
pub fn delete_kind(kind: String, state: tauri::State<'_, AppState>) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    service.delete_kind(&Kind::from(kind.as_str()))?;
    Ok(())
}

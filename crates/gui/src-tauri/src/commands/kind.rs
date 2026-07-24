use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::primitives::Kind;
use domain::schema::KindDef;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct KindDefDto {
    pub label: String,
    pub icon: String,
    pub title_prop: String,
    pub view: Option<crate::dto::ViewDefDto>,
}

impl From<&KindDef> for KindDefDto {
    fn from(def: &KindDef) -> Self {
        Self {
            label: def.label.clone(),
            icon: def.icon.clone().unwrap_or_default(),
            title_prop: def.title_prop.as_str().to_string(),
            view: def.view.as_ref().map(crate::dto::ViewDefDto::from),
        }
    }
}

impl From<KindDefDto> for KindDef {
    fn from(dto: KindDefDto) -> Self {
        let mut def = KindDef::new(&dto.label, &dto.title_prop).with_icon(&dto.icon);
        if let Some(v) = dto.view {
            def = def.with_view(v.into());
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

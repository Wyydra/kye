use serde::{Deserialize, Serialize};

pub use storage_fs::dto::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatusDto {
    pub is_selected: bool,
    pub path: Option<String>,
}

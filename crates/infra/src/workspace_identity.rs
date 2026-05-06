use std::path::PathBuf;
use uuid::Uuid;

pub struct WorkspaceIdentity;

impl WorkspaceIdentity {
    pub fn get_or_create(workspace_dir: &PathBuf) -> anyhow::Result<Uuid> {
        let kye_dir = workspace_dir.join(domain::KYE_DIR);
        let id_file = kye_dir.join("workspace.json");

        if id_file.exists() {
            let content = std::fs::read_to_string(&id_file)?;
            let map: serde_json::Value = serde_json::from_str(&content)?;
            if let Some(id_str) = map.get("id").and_then(|v| v.as_str()) {
                if let Ok(id) = Uuid::parse_str(id_str) {
                    return Ok(id);
                }
            }
        }

        // Générer et persister
        let id = Uuid::new_v4();
        std::fs::create_dir_all(&kye_dir)?;
        let json = serde_json::json!({ "id": id.to_string() });
        std::fs::write(&id_file, serde_json::to_string_pretty(&json)?)?;
        Ok(id)
    }
}

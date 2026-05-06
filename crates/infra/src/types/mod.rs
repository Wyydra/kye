pub mod dto;

use std::fs;
use std::path::Path;
use domain::models::block::schema::TypeName;
use crate::types::dto::TypeDefinitionDto;

pub struct TypeLoader;

impl TypeLoader {
    pub fn load_from_dir(
        workspace_path: &Path
    ) -> anyhow::Result<std::collections::BTreeMap<TypeName, domain::models::block::schema::TypeDefinition>> {
        let mut results = std::collections::BTreeMap::new();
        let types_dir = workspace_path.join(domain::KYE_DIR).join("types");
        
        if !types_dir.exists() {
            return Ok(results);
        }

        for entry in fs::read_dir(types_dir)? {
            let entry = entry?;
            let path = entry.path();
            
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                let name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .ok_or_else(|| anyhow::anyhow!("Invalid file name"))?;
                
                let content = match fs::read_to_string(&path) {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::error!("Failed to read type file {:?}: {}", path, e);
                        continue;
                    }
                };
                
                let dto: TypeDefinitionDto = match serde_json::from_str(&content) {
                    Ok(d) => d,
                    Err(e) => {
                        tracing::error!("Failed to parse type JSON {:?}: {}", path, e);
                        continue;
                    }
                };
                
                results.insert(TypeName::new(name), dto.to_domain());
                tracing::info!("Loaded type: {}", name);
            }
        }
        
        Ok(results)
    }
}

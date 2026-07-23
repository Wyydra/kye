

use std::path::{Path, PathBuf};
use std::fs;

use domain::ports::RepositoryError;

pub const KYE_DIR: &str = ".kye";
const META_FILE: &str = "meta.json";

#[derive(Clone, Debug)]
pub struct WorkspaceFs {
    pub root: PathBuf,
}

impl WorkspaceFs {
    pub fn new(workspace_root: impl AsRef<Path>) -> Self {
        Self { root: workspace_root.as_ref().to_path_buf() }
    }

    pub fn init(&self) -> Result<(), RepositoryError> {
        fs::create_dir_all(self.kye_dir())
            .map_err(|e| RepositoryError::Io(e.to_string()))?;

        let meta_path = self.meta_path();
        if !meta_path.exists() {
            let default_meta = serde_json::json!({
                "id": uuid::Uuid::new_v4(),
                "name": self.root.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("New Workspace")
            });
            let content = serde_json::to_string_pretty(&default_meta)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
            fs::write(meta_path, content)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Ok(())
    }

    pub fn kye_dir(&self) -> PathBuf {
        self.root.join(KYE_DIR)
    }

    pub fn meta_path(&self) -> PathBuf {
        self.kye_dir().join(META_FILE)
    }


    pub fn read_file(&self, path: &Path) -> Result<String, RepositoryError> {
        fs::read_to_string(path)
            .map_err(|e| RepositoryError::Io(e.to_string()))
    }

    pub fn write_file(&self, path: &Path, content: &str) -> Result<(), RepositoryError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        fs::write(path, content)
            .map_err(|e| RepositoryError::Io(e.to_string()))
    }

    pub fn delete_file(&self, path: &Path) -> Result<(), RepositoryError> {
        if path.exists() {
            fs::remove_file(path)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Ok(())
    }

    pub fn list_node_files(&self) -> Result<Vec<PathBuf>, RepositoryError> {
        let mut entries = Vec::new();
        for entry in walkdir::WalkDir::new(&self.root)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                !name.starts_with('.') && name != "target" && name != "node_modules"
            })
            .filter_map(|e| e.ok())
        {
            if entry.path().is_file() && entry.path().extension().map(|ext| ext == "md").unwrap_or(false) {
                entries.push(entry.into_path());
            }
        }
        Ok(entries)
    }
}

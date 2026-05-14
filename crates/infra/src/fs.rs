//! WorkspaceFs — abstraction du dossier `.kye/` sur le filesystem.

use std::path::{Path, PathBuf};
use std::fs;

use domain::ports::RepositoryError;

pub const KYE_DIR: &str = ".kye";
const NODES_DIR: &str = "nodes";
const META_FILE: &str = "meta.json";
const ASSETS_DIR: &str = "assets";

#[derive(Clone, Debug)]
pub struct WorkspaceFs {
    root: PathBuf,
}

impl WorkspaceFs {
    pub fn new(workspace_root: impl AsRef<Path>) -> Self {
        Self { root: workspace_root.as_ref().to_path_buf() }
    }

    /// Crée la structure de dossiers et le fichier meta.json si nécessaire.
    pub fn init(&self) -> Result<(), RepositoryError> {
        fs::create_dir_all(self.nodes_dir())
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        fs::create_dir_all(self.assets_dir())
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

    pub fn nodes_dir(&self) -> PathBuf {
        self.kye_dir().join(NODES_DIR)
    }

    /// Dossier des assets physiques à la racine du workspace.
    pub fn assets_dir(&self) -> PathBuf {
        self.root.join(ASSETS_DIR)
    }

    pub fn meta_path(&self) -> PathBuf {
        self.kye_dir().join(META_FILE)
    }

    /// Chemin du fichier JSON d'un node.
    pub fn node_path(&self, id: &str) -> PathBuf {
        self.nodes_dir().join(format!("{}.json", id))
    }

    /// Lit un fichier et retourne son contenu.
    pub fn read_file(&self, path: &Path) -> Result<String, RepositoryError> {
        fs::read_to_string(path)
            .map_err(|e| RepositoryError::Io(e.to_string()))
    }

    /// Écrit un fichier (crée les parents si nécessaire).
    pub fn write_file(&self, path: &Path, content: &str) -> Result<(), RepositoryError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        fs::write(path, content)
            .map_err(|e| RepositoryError::Io(e.to_string()))
    }

    /// Supprime un fichier de node.
    pub fn delete_node_file(&self, id: &str) -> Result<(), RepositoryError> {
        let path = self.node_path(id);
        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Ok(())
    }

    /// Liste tous les fichiers `.json` dans le dossier nodes.
    pub fn list_node_files(&self) -> Result<Vec<PathBuf>, RepositoryError> {
        let dir = self.nodes_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }
        let entries = fs::read_dir(&dir)
            .map_err(|e| RepositoryError::Io(e.to_string()))?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|ext| ext == "json").unwrap_or(false))
            .collect();
        Ok(entries)
    }
}

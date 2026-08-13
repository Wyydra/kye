use std::fs;
use uuid::Uuid;

use domain::ports::{AssetRepository, RepositoryError};

use crate::fs::WorkspaceFs;

#[derive(Clone)]
pub struct FileAssetRepository {
    fs: WorkspaceFs,
}

impl FileAssetRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }
}

impl AssetRepository for FileAssetRepository {
    fn save_asset(&self, filename: &str, data: &[u8]) -> Result<String, RepositoryError> {
        let asset_id = Uuid::new_v4().to_string();
        let target_filename = format!("assets/{}_{}", &asset_id[..8], filename);
        let abs_path = self.fs.root.join(&target_filename);

        if let Some(parent) = abs_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        fs::write(&abs_path, data)
            .map_err(|e| RepositoryError::Io(format!("Failed to write asset file: {}", e)))?;

        Ok(target_filename)
    }

    fn read_asset(&self, target: &str) -> Result<Vec<u8>, RepositoryError> {
        let abs_path = self.fs.root.join(target);
        fs::read(&abs_path).map_err(|e| RepositoryError::Io(format!("Failed to read asset: {}", e)))
    }
}

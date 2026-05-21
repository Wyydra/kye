use std::fs;
use std::path::Path;

use uuid::Uuid;

use domain::ports::{MediaRepository, RepositoryError};

use crate::fs::WorkspaceFs;

pub struct FileMediaRepository {
    fs: WorkspaceFs,
}

impl FileMediaRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }
}

impl MediaRepository for FileMediaRepository {
    fn import_media(&self, source_path: &str) -> Result<String, RepositoryError> {
        let source_path = Path::new(source_path);
        if !source_path.exists() {
            return Err(RepositoryError::NotFound(format!("File not found: {:?}", source_path)));
        }

        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let file_name = format!("{}.{}", Uuid::new_v4(), ext);

        let target_path = self.fs.assets_dir().join(&file_name);

        fs::copy(source_path, &target_path)
            .map_err(|e| RepositoryError::Io(format!("Failed to copy media: {}", e)))?;

        Ok(format!("assets/{}", file_name))
    }

    fn save_media(&self, data: &[u8], extension: &str) -> Result<String, RepositoryError> {

        let file_name = format!("{}.{}", Uuid::new_v4(), extension);

        let target_path = self.fs.assets_dir().join(&file_name);

        fs::write(&target_path, data)
            .map_err(|e| RepositoryError::Io(format!("Failed to save media bytes: {}", e)))?;

        Ok(format!("assets/{}", file_name))
    }
}

use std::fs;
use std::path::{Path, PathBuf};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::process::Command;
use uuid::Uuid;

use domain::AssetInfo;
use domain::ports::{AssetRepository, RepositoryError};

use crate::fs::WorkspaceFs;

pub struct FileAssetRepository {
    fs: WorkspaceFs,
}

impl FileAssetRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }
}

impl AssetRepository for FileAssetRepository {
    fn import_media(&self, source_path_str: &str) -> Result<String, RepositoryError> {
        let source_path = Path::new(source_path_str);
        if !source_path.exists() {
            return Err(RepositoryError::NotFound(format!(
                "Source file not found: {}",
                source_path_str
            )));
        }

        let extension = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let data = fs::read(source_path).map_err(|e| {
            RepositoryError::Io(format!("Failed to read source media file: {}", e))
        })?;

        self.save_media(&data, extension)
    }

    fn save_media(&self, data: &[u8], extension: &str) -> Result<String, RepositoryError> {
        let file_id = Uuid::new_v4().to_string();
        let file_name = format!("{}.{}", file_id, extension);
        let rel_path = format!("media/{}", file_name);
        let abs_path = self.fs.root.join(&rel_path);

        if let Some(parent) = abs_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                RepositoryError::Io(format!("Failed to create media directory: {}", e))
            })?;
        }

        fs::write(&abs_path, data).map_err(|e| {
            RepositoryError::Io(format!("Failed to write media file: {}", e))
        })?;

        Ok(rel_path)
    }

    fn import_asset(&self, source_path_str: &str) -> Result<AssetInfo, RepositoryError> {
        let source_path = Path::new(source_path_str);
        if !source_path.exists() {
            return Err(RepositoryError::NotFound(format!(
                "Asset file not found: {}",
                source_path_str
            )));
        }

        let filename = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| RepositoryError::Corrupted("Invalid asset filename".into()))?;

        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let asset_id = Uuid::new_v4().to_string();
        let target_filename = format!("{}_{}", asset_id, filename);
        let rel_path = format!("assets/{}", target_filename);
        let abs_path = self.fs.root.join(&rel_path);

        if let Some(parent) = abs_path.parent() {
            fs::create_dir_all(parent).map_err(|e| {
                RepositoryError::Io(format!("Failed to create assets directory: {}", e))
            })?;
        }

        fs::copy(source_path, &abs_path).map_err(|e| {
            RepositoryError::Io(format!("Failed to copy asset file: {}", e))
        })?;

        let mime_type = match ext.as_str() {
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "pdf" => "application/pdf",
            "mp4" => "video/mp4",
            "mp3" => "audio/mpeg",
            "json" => "application/json",
            "txt" | "md" => "text/plain",
            _ => "application/octet-stream",
        }
        .to_string();

        let meta = fs::metadata(&abs_path)
            .map_err(|e| RepositoryError::Io(format!("Failed to read asset metadata: {}", e)))?;

        let size_bytes = meta.len();

        Ok(AssetInfo::new(
            rel_path.clone(),
            format!("{}.meta", rel_path),
            mime_type,
            size_bytes,
        ))
    }

    fn open_external(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.fs.root.join(target_path_str)
        };

        if !abs_path.exists() {
            return Err(RepositoryError::NotFound(format!(
                "Target file for external open does not exist: {}",
                abs_path.display()
            )));
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "", &abs_path.to_string_lossy()])
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        Ok(())
    }

    fn reveal_in_explorer(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.fs.root.join(target_path_str)
        };

        let _parent_dir = abs_path.parent().unwrap_or(&self.fs.root);

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(_parent_dir)
                .spawn()
                .map_err(|e| {
                    RepositoryError::Io(format!("Failed to open directory in file manager: {}", e))
                })?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg("-R")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to reveal file: {}", e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("explorer")
                .arg("/select,")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| {
                    RepositoryError::Io(format!("Failed to reveal file in explorer: {}", e))
                })?;
        }

        Ok(())
    }
}

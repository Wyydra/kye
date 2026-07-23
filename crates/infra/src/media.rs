use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use uuid::Uuid;
use chrono::Utc;

use domain::ports::{AssetRepository, RepositoryError};
use domain::AssetInfo;

use crate::fs::WorkspaceFs;

pub struct FileAssetRepository {
    fs: WorkspaceFs,
}

impl FileAssetRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }

    fn guess_mime_type(ext: &str) -> String {
        match ext.to_lowercase().as_str() {
            "pdf" => "application/pdf".to_string(),
            "png" => "image/png".to_string(),
            "jpg" | "jpeg" => "image/jpeg".to_string(),
            "svg" => "image/svg+xml".to_string(),
            "gif" => "image/gif".to_string(),
            "webp" => "image/webp".to_string(),
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document".to_string(),
            "doc" => "application/msword".to_string(),
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".to_string(),
            "xls" => "application/vnd.ms-excel".to_string(),
            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation".to_string(),
            "ppt" => "application/vnd.ms-powerpoint".to_string(),
            "txt" => "text/plain".to_string(),
            "md" => "text/markdown".to_string(),
            "zip" => "application/zip".to_string(),
            "json" => "application/json".to_string(),
            "mp3" => "audio/mpeg".to_string(),
            "mp4" => "video/mp4".to_string(),
            _ => "application/octet-stream".to_string(),
        }
    }
}

impl AssetRepository for FileAssetRepository {

    fn import_media(&self, source_path: &str) -> Result<String, RepositoryError> {
        let asset_info = self.import_asset(source_path)?;
        Ok(asset_info.target_path)
    }

    fn save_media(&self, data: &[u8], extension: &str) -> Result<String, RepositoryError> {
        let file_name = format!("{}.{}", Uuid::new_v4(), extension);
        let target_path = self.fs.root.join(&file_name);

        fs::write(&target_path, data)
            .map_err(|e| RepositoryError::Io(format!("Failed to save media bytes: {}", e)))?;

        let sidecar_filename = format!("{}.md", file_name);
        let sidecar_path = self.fs.root.join(&sidecar_filename);

        let node_id = Uuid::new_v4();
        let mime_type = Self::guess_mime_type(extension);
        let size_bytes = data.len() as u64;

        let yaml_frontmatter = format!(
            "---\nid: {}\nkind: file\ntarget: {}\nmime_type: {}\nsize_bytes: {}\ncreated_at: {}\nupdated_at: {}\n---\n",
            node_id,
            file_name,
            mime_type,
            size_bytes,
            Utc::now().to_rfc3339(),
            Utc::now().to_rfc3339(),
        );

        fs::write(&sidecar_path, yaml_frontmatter)
            .map_err(|e| RepositoryError::Io(format!("Failed to write sidecar file: {}", e)))?;

        Ok(file_name)
    }

    fn import_asset(&self, source_path_str: &str) -> Result<AssetInfo, RepositoryError> {
        let source_path = Path::new(source_path_str);
        if !source_path.exists() {
            return Err(RepositoryError::NotFound(format!("File not found: {:?}", source_path)));
        }

        let original_file_name = source_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("file.bin");

        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("");

        let target_file_path = self.fs.root.join(original_file_name);
        let final_target_name = if target_file_path.exists() && source_path != target_file_path {
            let stem = source_path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
            let uuid_short = &Uuid::new_v4().to_string()[..8];
            if ext.is_empty() {
                format!("{}_{}", stem, uuid_short)
            } else {
                format!("{}_{}.{}", stem, uuid_short, ext)
            }
        } else {
            original_file_name.to_string()
        };

        let target_path = self.fs.root.join(&final_target_name);
        if source_path != target_path {
            fs::copy(source_path, &target_path)
                .map_err(|e| RepositoryError::Io(format!("Failed to copy asset file: {}", e)))?;
        }

        let sidecar_name = format!("{}.md", final_target_name);
        let sidecar_path = self.fs.root.join(&sidecar_name);

        let metadata = fs::metadata(&target_path)
            .map_err(|e| RepositoryError::Io(format!("Failed to read asset metadata: {}", e)))?;
        let size_bytes = metadata.len();
        let mime_type = Self::guess_mime_type(ext);
        let node_id = Uuid::new_v4();

        if !sidecar_path.exists() {
            let frontmatter = format!(
                "---\nid: {}\nkind: file\ntarget: {}\nmime_type: {}\nsize_bytes: {}\ncreated_at: {}\nupdated_at: {}\n---\n# {}\n\n",
                node_id,
                final_target_name,
                mime_type,
                size_bytes,
                Utc::now().to_rfc3339(),
                Utc::now().to_rfc3339(),
                final_target_name,
            );
            fs::write(&sidecar_path, frontmatter)
                .map_err(|e| RepositoryError::Io(format!("Failed to create sidecar note: {}", e)))?;
        }

        Ok(AssetInfo::new(final_target_name, sidecar_name, mime_type, size_bytes)
            .with_node_id(domain::NodeId::from_uuid(node_id)))
    }


    fn open_external(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.fs.root.join(target_path_str)
        };

        if !abs_path.exists() {
            return Err(RepositoryError::NotFound(format!("File does not exist: {:?}", abs_path)));
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to launch xdg-open: {}", e)))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to launch open: {}", e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "", abs_path.to_str().unwrap_or_default()])
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to launch start command: {}", e)))?;
        }

        Ok(())
    }

    fn reveal_in_explorer(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.fs.root.join(target_path_str)
        };

        let parent_dir = abs_path.parent().unwrap_or(&self.fs.root);

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(parent_dir)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open directory in file manager: {}", e)))?;
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
                .map_err(|e| RepositoryError::Io(format!("Failed to reveal file in explorer: {}", e)))?;
        }

        Ok(())
    }
}

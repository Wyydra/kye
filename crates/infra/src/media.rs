use std::fs;
use std::path::Path;
use uuid::Uuid;

use domain::ports::{AssetRepository, RepositoryError};

use crate::fs::WorkspaceFs;

fn mime_to_kind(mime: &str) -> domain::Kind {
    if mime.starts_with("image/") {
        return domain::kinds::image();
    }
    if mime.starts_with("audio/") {
        return domain::kinds::audio();
    }
    domain::kinds::binary()
}

pub struct FileAssetRepository {
    fs: WorkspaceFs,
}

impl FileAssetRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }
}

impl AssetRepository for FileAssetRepository {
    fn import_asset(&self, source_path_str: &str) -> Result<domain::Node, RepositoryError> {
        let source_path = Path::new(source_path_str);
        if !source_path.exists() {
            return Err(RepositoryError::NotFound(format!(
                "Asset source file not found: {}",
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
        let target_filename = format!("{}_{}", &asset_id[..8], filename);
        let rel_path = target_filename.clone();
        let abs_path = self.fs.root.join(&rel_path);

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
            "mp3" | "wav" | "ogg" | "m4a" => "audio/mpeg",
            "json" => "application/json",
            "txt" | "md" => "text/plain",
            _ => "application/octet-stream",
        };

        let meta = fs::metadata(&abs_path)
            .map_err(|e| RepositoryError::Io(format!("Failed to read asset metadata: {}", e)))?;

        let size_bytes = meta.len();
        let node_id = domain::NodeId::new();
        let kind = mime_to_kind(mime_type);

        let mut props = domain::Props::new();
        props.insert(
            domain::PropKey::from("target"),
            domain::Value::Text(std::sync::Arc::from(rel_path.as_str())),
        );
        props.insert(
            domain::PropKey::from("mime_type"),
            domain::Value::Text(std::sync::Arc::from(mime_type)),
        );
        props.insert(
            domain::PropKey::from("size_bytes"),
            domain::Value::Int(size_bytes as i64),
        );
        props.insert(
            domain::PropKey::from("title"),
            domain::Value::Text(std::sync::Arc::from(filename)),
        );

        let sidecar_node = domain::NodeBuilder::new(kind, chrono::Utc::now())
            .with_id(node_id)
            .with_props(props)
            .build();

        Ok(sidecar_node)
    }
}

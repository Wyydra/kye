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

        // Extraire l'extension du fichier source
        let ext = source_path
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        // Générer un nom unique
        let file_name = format!("{}.{}", Uuid::new_v4(), ext);
        
        // Construire le chemin cible dans le dossier assets/
        let target_path = self.fs.assets_dir().join(&file_name);

        // Copier le fichier
        fs::copy(source_path, &target_path)
            .map_err(|e| RepositoryError::Io(format!("Failed to copy media: {}", e)))?;

        // L'URL relative à stocker dans le domaine
        Ok(format!("assets/{}", file_name))
    }
}

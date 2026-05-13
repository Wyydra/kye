//! FileKindRepository — persistance des KindDefs user-defined.


use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use domain::ports::{KindRepository, RepositoryError};
use domain::primitives::Kind;
use domain::schema::KindDef;

use crate::fs::WorkspaceFs;

const KINDS_DIR: &str = "kinds";

#[derive(Clone)]
pub struct FileKindRepository {
    fs: WorkspaceFs,
}

impl FileKindRepository {
    pub fn new(fs: WorkspaceFs) -> Self {
        Self { fs }
    }

    fn kinds_dir(&self) -> PathBuf {
        self.fs.kye_dir().join(KINDS_DIR)
    }

    fn kind_path(&self, kind: &Kind) -> PathBuf {
        // Remplace les points par des slashes pour le namespace
        let filename = kind.as_str().replace('.', "__");
        self.kinds_dir().join(format!("{}.json", filename))
    }
}

impl KindRepository for FileKindRepository {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError> {
        let dir = self.kinds_dir();
        if !dir.exists() {
            return Ok(Vec::new());
        }

        let mut result = Vec::new();
        let entries = std::fs::read_dir(&dir)
            .map_err(|e| RepositoryError::Io(e.to_string()))?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|ext| ext == "json").unwrap_or(false));

        for path in entries {
            let content = self.fs.read_file(&path)?;
            let dto: KindDefJson = serde_json::from_str(&content)
                .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
            let kind = Kind::from(dto.kind.as_str());
            let def = dto.into_kind_def();
            result.push((kind, def));
        }

        Ok(result)
    }

    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError> {
        std::fs::create_dir_all(self.kinds_dir())
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        let dto = KindDefJson::from_kind_def(kind, def);
        let content = serde_json::to_string_pretty(&dto)
            .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
        self.fs.write_file(&self.kind_path(kind), &content)
    }

    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError> {
        let path = self.kind_path(kind);
        if path.exists() {
            std::fs::remove_file(path)
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Ok(())
    }
}

// ── DTO ───────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct KindDefJson {
    kind: String,
    label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    title_prop: String,
}

impl KindDefJson {
    fn from_kind_def(kind: &Kind, def: &KindDef) -> Self {
        Self {
            kind: kind.as_str().to_string(),
            label: def.label.clone(),
            icon: def.icon.clone(),
            title_prop: def.title_prop.as_str().to_string(),
        }
    }

    fn into_kind_def(self) -> KindDef {
        KindDef::new(&self.label, self.title_prop.as_str())
            .with_icon(self.icon.as_deref().unwrap_or(""))
    }
}

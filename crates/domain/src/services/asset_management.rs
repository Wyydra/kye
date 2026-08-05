use std::fs;
use std::path::Path;

use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository, RepositoryError, SystemShellPort};

use super::service::{Service, ServiceError};

impl<R, K, E, A, S> Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub fn save_asset(&self, filename: &str, data: &[u8]) -> Result<String, ServiceError> {
        let url = self.asset_repo.save_asset(filename, data)?;
        Ok(url)
    }

    pub fn import_asset_from_file(&self, source_path_str: &str) -> Result<String, ServiceError> {
        let path = Path::new(source_path_str);
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("asset.bin");

        let bytes = fs::read(path)
            .map_err(|e| RepositoryError::Io(format!("Failed to read asset file '{}': {}", source_path_str, e)))?;

        self.save_asset(filename, &bytes)
    }

    pub fn read_asset(&self, target: &str) -> Result<Vec<u8>, ServiceError> {
        Ok(self.asset_repo.read_asset(target)?)
    }
}

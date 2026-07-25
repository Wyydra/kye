use crate::model::asset::AssetInfo;
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository};
use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn import_media(&self, source_path: &str) -> Result<String, ServiceError> {
        Ok(self.asset_repo.import_media(source_path)?)
    }

    pub fn save_media(&self, data: &[u8], extension: &str) -> Result<String, ServiceError> {
        Ok(self.asset_repo.save_media(data, extension)?)
    }

    pub fn import_asset(&self, source_path: &str) -> Result<AssetInfo, ServiceError> {
        Ok(self.asset_repo.import_asset(source_path)?)
    }

    pub fn open_external(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.asset_repo.open_external(target_path)?)
    }

    pub fn reveal_in_explorer(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.asset_repo.reveal_in_explorer(target_path)?)
    }
}

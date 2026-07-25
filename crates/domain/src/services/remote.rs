use crate::model::remote::{Remote, RemoteName, RemoteUrl};
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository};
use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn add_remote(&self, name: RemoteName, url: RemoteUrl) -> Result<(), ServiceError> {
        let mut meta = self.repo.load_meta()?;
        meta.add_remote(name, url);
        self.repo.save_meta(&meta)?;
        Ok(())
    }

    pub fn remove_remote(&self, name: &RemoteName) -> Result<bool, ServiceError> {
        let mut meta = self.repo.load_meta()?;
        let removed = meta.remove_remote(name);
        if removed {
            self.repo.save_meta(&meta)?;
        }
        Ok(removed)
    }

    pub fn list_remotes(&self) -> Result<Vec<Remote>, ServiceError> {
        let meta = self.repo.load_meta()?;
        Ok(meta.list_remotes())
    }

    pub fn set_default_remote(&self, name: &RemoteName) -> Result<(), ServiceError> {
        let mut meta = self.repo.load_meta()?;
        meta.set_default_remote(name.clone())
            .map_err(|e| ServiceError::RemoteNotFound(e))?;
        self.repo.save_meta(&meta)?;
        Ok(())
    }

    pub fn get_default_remote(&self) -> Result<Option<Remote>, ServiceError> {
        let meta = self.repo.load_meta()?;
        Ok(meta.get_remote(None))
    }

    pub fn get_remote(&self, name: Option<&RemoteName>) -> Result<Option<Remote>, ServiceError> {
        let meta = self.repo.load_meta()?;
        Ok(meta.get_remote(name))
    }
}

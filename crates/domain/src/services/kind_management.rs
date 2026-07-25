use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository};
use crate::primitives::Kind;
use crate::schema::KindDef;
use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn refresh_kinds(&self) -> Result<(), ServiceError> {
        let user_kinds = self.kind_repo.load_kinds()?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        for (kind, def) in user_kinds {
            registry.register(kind, def);
        }
        Ok(())
    }

    pub fn get_all_kinds(&self) -> Result<Vec<(Kind, KindDef)>, ServiceError> {
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;
        Ok(registry
            .iter()
            .map(|(k, d)| (k.clone(), d.clone()))
            .collect())
    }

    pub fn register_kind(&self, kind: Kind, def: KindDef) -> Result<(), ServiceError> {
        self.kind_repo.save_kind(&kind, &def)?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        registry.register(kind, def);
        Ok(())
    }

    pub fn delete_kind(&self, kind: &Kind) -> Result<(), ServiceError> {
        self.kind_repo.delete_kind(kind)?;
        let mut registry = self
            .registry
            .write()
            .map_err(|_| ServiceError::LockPoisoned)?;
        registry.unregister(kind);
        Ok(())
    }
}

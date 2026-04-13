use uuid::Uuid;
use crate::models::block::metadata::Fields;

use crate::{
    models::{
        block::{Block, CreateBlockError, CreateBlockRequest, UpdateBlockError, UpdateBlockRequest, type_registry::TypeRegistry, stdlib::StandardLibrary}, workspace::Workspace
    },
    ports::{BlockService, EventDispatcher, WorkspaceRepository},
};

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    repo: R,
    dispatcher: E,
    registry: TypeRegistry,
    last_internal_save: Arc<Mutex<Option<Instant>>>,
}

impl<R, E> Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    pub fn new(repo: R, dispatcher: E) -> Self {
        let mut registry = TypeRegistry::new();
        StandardLibrary::init(&mut registry);
        Self { 
            repo, 
            dispatcher, 
            registry, 
            last_internal_save: Arc::new(Mutex::new(None)) 
        }
    }

    fn record_internal_save(&self) {
        if let Ok(mut guard) = self.last_internal_save.lock() {
            *guard = Some(Instant::now());
        }
    }

    async fn mutate_workspace<T, F>(&self, f: F) -> anyhow::Result<(Workspace, T)>
    where
        F: FnOnce(&mut Workspace) -> anyhow::Result<T>,
    {
        let mut workspace = self.repo.load_workspace().await?;
        let result = f(&mut workspace)?;
        self.repo.save_workspace(&workspace).await?;
        self.record_internal_save();
        Ok((workspace, result))
    }

    pub fn notify_external_update(&self) {
        if let Ok(guard) = self.last_internal_save.lock() {
            if let Some(last_save) = *guard {
                if last_save.elapsed() < Duration::from_millis(1000) {
                    tracing::debug!("Ignoring external update within silence window");
                    return;
                }
            }
        }
        self.dispatcher.dispatch_workspace_updated();
    }
}

impl<R, E> BlockService for Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    async fn get_workspace(&self) -> Result<Workspace, anyhow::Error> {
        self.repo.load_workspace().await
    }

    async fn create_block(&self, req: &CreateBlockRequest) -> Result<(Workspace, Uuid), CreateBlockError> {
        self.mutate_workspace(|workspace| {
            let id = Uuid::new_v4();
            let metadata = crate::models::block::metadata::Metadata::new(id, req.fields().clone());
            let new_block = Block::new(req.content().clone(), metadata);

            workspace.add_block(new_block.clone()).map_err(|e| {
                anyhow::anyhow!("Validation error: {}", e)
            })?;

            Ok(id)
        })
        .await
        .map_err(|e| CreateBlockError::Unknown(e))
    }

    async fn update_block(&self, req: &UpdateBlockRequest) -> Result<Workspace, UpdateBlockError> {
        self.mutate_workspace(|workspace| {
            workspace.update_block(req).map_err(|e| anyhow::anyhow!(e))
        })
        .await
        .map(|(ws, _)| ws)
        .map_err(|e| UpdateBlockError::Unknown(e))
    }

    async fn delete_block(&self, id: Uuid) -> Result<Workspace, anyhow::Error> {
        self.mutate_workspace(|workspace| {
            workspace.remove_block(id);
            Ok(())
        })
        .await
        .map(|(ws, _)| ws)
    }

    fn get_block_types(&self) -> Vec<String> {
        self.registry.types().keys().map(|k| k.to_string()).collect()
    }

    fn identify_block_shapes(&self, fields: &Fields) -> Vec<String> {
        let mut matching_shapes = Vec::new();
        for (name, definition) in self.registry.types() {
            if fields.satisfies(definition) {
                matching_shapes.push(name.to_string());
            }
        }
        matching_shapes
    }

    fn notify_external_update(&self) {
        Service::notify_external_update(self);
    }
}

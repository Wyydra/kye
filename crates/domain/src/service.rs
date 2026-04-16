use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use uuid::Uuid;

use crate::{
    models::{
        block::{
            Block, CreateBlockError, CreateBlockRequest,
            DeleteBlockError, UpdateBlockError, UpdateBlockRequest,
            metadata::{Fields, Metadata},
            schema::{TypeDefinition, TypeName},
            stdlib::StandardLibrary,
            type_registry::TypeRegistry,
        },
        workspace::{AddBlockError, RemoveBlockError, SaveWorkspaceError, Workspace},
    },
    ports::{
        EventDispatcher, ExternalEventHandler,
        TypeInspector, WorkspaceRepository, WorkspaceUseCase,
    },
};

// ── Service ───────────────────────────────────────────────────────────────────

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
            last_internal_save: Arc::new(Mutex::new(None)),
        }
    }

    fn record_internal_save(&self) {
        if let Ok(mut guard) = self.last_internal_save.lock() {
            *guard = Some(Instant::now());
        }
    }

    async fn mutate_workspace<T, Err, F>(&self, f: F) -> Result<(Workspace, T), Err>
    where
        Err: From<anyhow::Error> + From<SaveWorkspaceError>,
        F: FnOnce(&mut Workspace) -> Result<T, Err>,
    {
        let mut workspace = self.repo.load_workspace().await.map_err(Err::from)?;
        let result = f(&mut workspace)?;
        self.repo.save_workspace(&workspace).await.map_err(Err::from)?;
        self.record_internal_save();
        Ok((workspace, result))
    }
}


impl<R, E> WorkspaceUseCase for Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    async fn get_workspace(&self) -> Result<Workspace, anyhow::Error> {
        self.repo.load_workspace().await
    }

    async fn create_block(
        &self,
        req: &CreateBlockRequest,
    ) -> Result<(Workspace, Uuid), CreateBlockError> {
        self.mutate_workspace(|workspace| -> Result<Uuid, CreateBlockError> {
            let id = Uuid::new_v4();
            let metadata = Metadata::new(id, req.fields().clone());
            let new_block = Block::new(req.content().clone(), metadata);
            workspace.add_block(new_block).map_err(|e| match e {
                AddBlockError::DuplicateId(id) => CreateBlockError::DuplicateId(id),
            })?;
            Ok(id)
        })
        .await
    }

    async fn update_block(
        &self,
        req: &UpdateBlockRequest,
    ) -> Result<Workspace, UpdateBlockError> {
        self.mutate_workspace(|workspace| workspace.update_block(req))
            .await
            .map(|(ws, _)| ws)
    }

    async fn delete_block(&self, id: Uuid) -> Result<Workspace, DeleteBlockError> {
        self.mutate_workspace(|workspace| {
            workspace.remove_block(id).map_err(|e| match e {
                RemoveBlockError::NotFound(rid) => DeleteBlockError::NotFound(rid),
            })
        })
        .await
        .map(|(ws, _)| ws)
    }
}


impl<R, E> TypeInspector for Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    fn get_block_types(&self) -> Vec<String> {
        self.registry.types().keys().map(|k| k.to_string()).collect()
    }

    fn identify_block_shapes(&self, fields: &Fields) -> Vec<String> {
        self.registry
            .types()
            .iter()
            .filter_map(|(name, definition)| {
                if fields.satisfies(definition, &self.registry) {
                    Some(name.to_string())
                } else {
                    None
                }
            })
            .collect()
    }

    fn get_type_definition(&self, type_name: &str) -> Option<TypeDefinition> {
        self.registry.get(&TypeName::new(type_name)).cloned()
    }
}


impl<R, E> ExternalEventHandler for Service<R, E>
where
    R: WorkspaceRepository,
    E: EventDispatcher,
{
    fn on_workspace_file_changed(&self) {
        if let Ok(guard) = self.last_internal_save.lock() {
            if let Some(last_save) = *guard {
                if last_save.elapsed() < Duration::from_millis(1000) {
                    tracing::debug!(
                        "Changement externe ignoré (fenêtre de silence active)"
                    );
                    return;
                }
            }
        }
        self.dispatcher.dispatch_workspace_updated();
    }
}

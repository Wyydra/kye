use std::sync::{Arc, Mutex, RwLock};
use std::time::{Duration, Instant};

use uuid::Uuid;

use crate::{
    models::{
        block::{
            Block, CreateBlockError, CreateBlockRequest,
            DeleteBlockError, UpdateBlockError, UpdateBlockRequest,
            schema::{Fields, TypeDefinition, TypeName},
            stdlib::StandardLibrary,
            type_registry::TypeRegistry,
        },
        workspace::{AddBlockError, RemoveBlockError, SaveWorkspaceError, Workspace},
    },
    ports::{
        EventDispatcher, ExternalEventHandler,
        TypeInspector, WorkspaceRepository, TypeRepository, WorkspaceUseCase,
    },
};

// ── Service ───────────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct Service<R, T, E>
where
    R: WorkspaceRepository,
    T: TypeRepository,
    E: EventDispatcher,
{
    repo: R,
    type_repo: T,
    dispatcher: E,
    registry: Arc<RwLock<TypeRegistry>>,
    last_internal_save: Arc<Mutex<Option<Instant>>>,
}

impl<R, T, E> Service<R, T, E>
where
    R: WorkspaceRepository,
    T: TypeRepository,
    E: EventDispatcher,
{
    pub fn new(repo: R, type_repo: T, dispatcher: E) -> Self {
        let mut registry = TypeRegistry::new();
        StandardLibrary::init(&mut registry);
        Self {
            repo,
            type_repo,
            dispatcher,
            registry: Arc::new(RwLock::new(registry)),
            last_internal_save: Arc::new(Mutex::new(None)),
        }
    }
    
    pub async fn refresh_types(&self) -> anyhow::Result<()> {
        let new_types = match self.type_repo.load_types().await {
            Ok(t) => t,
            Err(e) => {
                tracing::error!("Failed to load types: {}", e);
                return Err(e);
            }
        };
        let mut registry = self.registry.write().map_err(|_| anyhow::anyhow!("Poison error"))?;
        for (name, definition) in new_types {
            registry.register(name, definition);
        }
        Ok(())
    }

    fn record_internal_save(&self) {
        if let Ok(mut guard) = self.last_internal_save.lock() {
            *guard = Some(Instant::now());
        }
    }

    async fn mutate_workspace<Res, Err, F>(&self, f: F) -> Result<(Workspace, Res), Err>
    where
        Err: From<anyhow::Error> + From<SaveWorkspaceError>,
        F: FnOnce(&mut Workspace) -> Result<Res, Err>,
    {
        let mut workspace = self.get_workspace().await.map_err(anyhow::Error::from).map_err(Err::from)?;
        let result = f(&mut workspace)?;
        
        let registry = self.registry.read().map_err(|_| anyhow::anyhow!("Poison error")).map_err(Err::from)?.clone();
        self.repo.save_workspace(&workspace, &registry).await.map_err(Err::from)?;
        self.record_internal_save();
        Ok((workspace, result))
    }

    pub fn render_block_source(&self, block: &Block) -> String {
        let registry = self.registry.read().unwrap();
        self.repo.render_block_source(block, &registry)
    }

    pub fn get_type_registry(&self) -> TypeRegistry {
        self.registry.read().unwrap().clone()
    }
}


impl<R, T, E> WorkspaceUseCase for Service<R, T, E>
where
    R: WorkspaceRepository,
    T: TypeRepository,
    E: EventDispatcher,
{
    async fn get_workspace(&self) -> Result<Workspace, anyhow::Error> {
        if let Err(e) = self.refresh_types().await {
            tracing::warn!("Type refresh failed, continuing with cached types: {}", e);
        }

        let registry = self.registry.read().map_err(|_| anyhow::anyhow!("Poison error"))?.clone();
        self.repo.load_workspace(&registry).await.map_err(|e| {
            tracing::error!("Failed to load workspace: {}", e);
            e
        })
    }

    async fn create_block(
        &self,
        req: &CreateBlockRequest,
    ) -> Result<(Workspace, Uuid), CreateBlockError> {
        self.mutate_workspace(|workspace| -> Result<Uuid, CreateBlockError> {
            let id = Uuid::new_v4();
            let new_block = Block::new(id, req.fields().clone());
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
        self.mutate_workspace(|workspace: &mut Workspace| {
            if let Some(block) = workspace.blocks_mut().iter_mut().find(|b| *b.id() == req.id()) {
                block.apply_changes(req.fields().clone());
                Ok(())
            } else {
                Err(UpdateBlockError::NotFound(req.id()))
            }
        })
        .await
        .map(|(ws, _): (Workspace, ())| ws)
    }


    async fn delete_block(&self, id: Uuid) -> Result<Workspace, DeleteBlockError> {
        self.mutate_workspace(|workspace: &mut Workspace| {
            workspace.remove_block(id).map_err(|e| match e {
                RemoveBlockError::NotFound(rid) => DeleteBlockError::NotFound(rid),
            })
        })
        .await
        .map(|(ws, _): (Workspace, ())| ws)
    }
}


impl<R, T, E> TypeInspector for Service<R, T, E>
where
    R: WorkspaceRepository,
    T: TypeRepository,
    E: EventDispatcher,
{
    fn get_block_types(&self) -> Vec<String> {
        self.registry.read().unwrap().types().keys().map(|k| k.to_string()).collect()
    }

    fn identify_block_shapes(&self, fields: &Fields) -> Vec<String> {
        let registry = self.registry.read().unwrap();
        
        // Priority to explicit type field
        if let Some(explicit_type) = fields.get(&crate::models::block::schema::FieldName::new("type")).and_then(|v| v.as_str()) {
            let type_name = crate::models::block::schema::TypeName::new(explicit_type);
            if let Some(definition) = registry.get(&type_name) {
                if fields.satisfies(definition, &registry) {
                    return vec![explicit_type.to_string()];
                }
            }
        }

        let mut matching_types: Vec<(String, usize)> = registry
            .types()
            .iter()
            .filter_map(|(name, definition)| {
                if fields.satisfies(definition, &registry) {
                    Some((name.to_string(), definition.fields.len()))
                } else {
                    None
                }
            })
            .collect();
            
        // Sort by field count descending (most specific first)
        matching_types.sort_by(|a, b| b.1.cmp(&a.1));
        
        matching_types.into_iter().map(|(name, _)| name).collect()
    }

    fn get_type_definition(&self, type_name: &str) -> Option<TypeDefinition> {
        self.registry.read().unwrap().get(&TypeName::new(type_name)).cloned()
    }
}


impl<R, T, E> ExternalEventHandler for Service<R, T, E>
where
    R: WorkspaceRepository,
    T: TypeRepository,
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

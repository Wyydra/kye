use std::future::Future;

use uuid::Uuid;

use crate::models::block::{
    CreateBlockError, CreateBlockRequest, DeleteBlockError,
    UpdateBlockError, UpdateBlockRequest,
};
use crate::models::block::schema::{Fields, TypeDefinition};
use crate::models::workspace::{SaveWorkspaceError, Workspace};

pub trait WorkspaceUseCase: Clone + Send + Sync + 'static {
    fn get_workspace(&self) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn create_block(
        &self,
        req: &CreateBlockRequest,
    ) -> impl Future<Output = Result<(Workspace, Uuid), CreateBlockError>> + Send;
    fn update_block(
        &self,
        req: &UpdateBlockRequest,
    ) -> impl Future<Output = Result<Workspace, UpdateBlockError>> + Send;
    fn delete_block(
        &self,
        id: Uuid,
    ) -> impl Future<Output = Result<Workspace, DeleteBlockError>> + Send;
}

pub trait TypeInspector: Clone + Send + Sync + 'static {
    fn get_block_types(&self) -> Vec<String>;
    fn identify_block_shapes(&self, fields: &Fields) -> Vec<String>;
    fn get_type_definition(&self, type_name: &str) -> Option<TypeDefinition>;
}

pub trait ExternalEventHandler: Clone + Send + Sync + 'static {
    fn on_workspace_file_changed(&self);
}

pub trait WorkspaceRepository: Send + Sync + Clone + 'static {
    fn load_workspace(&self, registry: &crate::models::block::type_registry::TypeRegistry) -> impl Future<Output = Result<Workspace, anyhow::Error>> + Send;
    fn save_workspace(
        &self,
        workspace: &Workspace,
        registry: &crate::models::block::type_registry::TypeRegistry,
    ) -> impl Future<Output = Result<(), SaveWorkspaceError>> + Send;
    fn render_block_source(&self, block: &crate::models::block::Block, registry: &crate::models::block::type_registry::TypeRegistry) -> String;
}

pub trait TypeRepository: Send + Sync + Clone + 'static {
    fn load_types(
        &self,
    ) -> impl Future<Output = Result<std::collections::BTreeMap<crate::models::block::schema::TypeName, crate::models::block::schema::TypeDefinition>, anyhow::Error>> + Send;
}

pub trait EventDispatcher: Clone + Send + Sync + 'static {
    fn dispatch_workspace_updated(&self);
}

impl EventDispatcher for () {
    fn dispatch_workspace_updated(&self) {}
}

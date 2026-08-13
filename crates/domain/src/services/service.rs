use chrono::Utc;
use std::sync::{Arc, RwLock};
use thiserror::Error;

use crate::command::{Command, CommandError, Event, apply};
use crate::graph::Graph;
use crate::model::remote::RemoteError;
use crate::model::workspace::WorkspaceMeta;
use crate::ports::{
    AssetRepository, EventBus, GraphRepository, KindRepository, RepositoryError, SyncError,
    SystemShellPort,
};
use crate::primitives::{Kind, NodeId};
use crate::query::{QueryBuilder, evaluate_query_node};
use crate::registry::KindRegistry;
use crate::resolver::SchemaResolver;
use crate::schema::KindDef;

#[derive(Debug, Error)]
pub enum ServiceError {
    #[error("Command error: {0}")]
    Command(#[from] CommandError),
    #[error("Storage error: {0}")]
    Storage(#[from] RepositoryError),
    #[error("Sync error: {0}")]
    Sync(#[from] SyncError),
    #[error("Remote error: {0}")]
    Remote(#[from] RemoteError),
    #[error("Remote not found: '{0}'")]
    RemoteNotFound(String),
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Registry lock poisoned")]
    LockPoisoned,
}

pub struct Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub(super) repo: R,
    pub(super) kind_repo: K,
    pub(super) bus: E,
    pub(super) asset_repo: A,
    pub(super) shell: S,
    pub(super) registry: Arc<RwLock<KindRegistry>>,
    pub(super) graph: Arc<RwLock<Graph>>,
}

impl<R, K, E, A, S> Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub fn new(repo: R, kind_repo: K, bus: E, asset_repo: A, shell: S) -> Self {
        let initial_graph = repo.load_graph().unwrap_or_default();
        let mut registry = KindRegistry::new();
        if let Ok(user_kinds) = kind_repo.load_kinds() {
            registry.load_all(user_kinds);
        }
        Self {
            repo,
            kind_repo,
            bus,
            asset_repo,
            shell,
            registry: Arc::new(RwLock::new(registry)),
            graph: Arc::new(RwLock::new(initial_graph)),
        }
    }

    pub fn load_graph(&self) -> Result<Graph, ServiceError> {
        let graph = self.graph.read().map_err(|_| ServiceError::LockPoisoned)?;
        Ok(graph.clone())
    }

    pub fn get_meta(&self) -> Result<WorkspaceMeta, ServiceError> {
        Ok(self.repo.load_meta()?)
    }

    pub fn open_external(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.shell.open_external(target_path)?)
    }

    pub fn reveal_in_explorer(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.shell.reveal_in_explorer(target_path)?)
    }

    pub fn execute(&self, cmd: Command) -> Result<Event, ServiceError> {
        let mut graph = self.graph.write().map_err(|_| ServiceError::LockPoisoned)?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let event = apply(&mut graph, &registry, cmd, Utc::now())?;

        drop(registry);
        self.repo.apply_event(&event)?;
        self.bus.publish(&event);

        Ok(event)
    }

    pub fn execute_batch(&self, cmds: Vec<Command>) -> Result<Event, ServiceError> {
        let mut graph = self.graph.write().map_err(|_| ServiceError::LockPoisoned)?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let snapshot = graph.clone();
        let mut events = Vec::new();
        let now = Utc::now();

        for cmd in cmds {
            match apply(&mut graph, &registry, cmd, now) {
                Ok(event) => events.push(event),
                Err(e) => {
                    *graph = snapshot;
                    return Err(ServiceError::Command(e));
                }
            }
        }

        drop(registry);
        let batch_event = Event::Batch(events);
        self.repo.apply_event(&batch_event)?;
        self.bus.publish(&batch_event);

        Ok(batch_event)
    }

    pub fn execute_query(&self, builder: QueryBuilder) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.graph.read().map_err(|_| ServiceError::LockPoisoned)?;
        Ok(builder.execute(&graph))
    }

    pub fn evaluate_query_node(&self, query_node_id: NodeId) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.graph.read().map_err(|_| ServiceError::LockPoisoned)?;
        Ok(evaluate_query_node(&graph, query_node_id))
    }

    pub fn validate_node_in_context(&self, node_id: NodeId) -> Result<(), ServiceError> {
        let graph = self.graph.read().map_err(|_| ServiceError::LockPoisoned)?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;
        let resolver = SchemaResolver::new(&graph, &registry);
        resolver
            .validate_in_context(node_id)
            .map_err(|_e| ServiceError::Command(CommandError::NotFound(node_id)))
    }

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ports::RepositoryError;
    use crate::primitives::{kinds, props};
    use crate::schema::{PropDef, ValueType};
    use std::collections::HashMap;
    use std::sync::Mutex;

    #[derive(Default)]
    struct MockGraphRepo {
        events: Mutex<Vec<Event>>,
        graph: Mutex<Graph>,
    }

    impl GraphRepository for MockGraphRepo {
        fn load_graph(&self) -> Result<Graph, RepositoryError> {
            Ok(self.graph.lock().unwrap().clone())
        }
        fn apply_event(&self, event: &Event) -> Result<(), RepositoryError> {
            self.events.lock().unwrap().push(event.clone());
            Ok(())
        }
        fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
            *self.graph.lock().unwrap() = graph.clone();
            Ok(())
        }
        fn load_tombstones(
            &self,
        ) -> Result<HashMap<NodeId, chrono::DateTime<Utc>>, RepositoryError> {
            Ok(HashMap::new())
        }
        fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError> {
            Ok(WorkspaceMeta::new(uuid::Uuid::new_v4(), "Test"))
        }
        fn save_meta(&self, _meta: &WorkspaceMeta) -> Result<(), RepositoryError> {
            Ok(())
        }
    }

    #[derive(Default)]
    struct MockKindRepo {
        kinds: Mutex<HashMap<Kind, KindDef>>,
    }

    impl KindRepository for MockKindRepo {
        fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError> {
            Ok(self
                .kinds
                .lock()
                .unwrap()
                .iter()
                .map(|(k, d)| (k.clone(), d.clone()))
                .collect())
        }
        fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError> {
            self.kinds
                .lock()
                .unwrap()
                .insert(kind.clone(), def.clone());
            Ok(())
        }
        fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError> {
            self.kinds.lock().unwrap().remove(kind);
            Ok(())
        }
    }

    struct DummyAssetRepo;
    impl crate::ports::AssetRepository for DummyAssetRepo {
        fn save_asset(&self, _filename: &str, _data: &[u8]) -> Result<String, RepositoryError> {
            Ok("dummy://".into())
        }
        fn read_asset(&self, _target: &str) -> Result<Vec<u8>, RepositoryError> {
            Ok(vec![])
        }
    }

    struct DummyShell;
    impl SystemShellPort for DummyShell {
        fn open_external(&self, _target: &str) -> Result<(), RepositoryError> {
            Ok(())
        }
        fn reveal_in_explorer(&self, _target: &str) -> Result<(), RepositoryError> {
            Ok(())
        }
    }

    #[test]
    fn test_service_in_memory_write_through_and_custom_kinds() {
        let repo = MockGraphRepo::default();
        let kind_repo = MockKindRepo::default();
        let service = Service::new(repo, kind_repo, (), DummyAssetRepo, DummyShell);

        // 1. Check built-in kinds are registered by default
        let all_kinds = service.get_all_kinds().expect("Failed to get kinds");
        assert!(all_kinds.iter().any(|(k, _)| k == &kinds::page()));

        // 2. Register custom kind
        let custom_kind = Kind::from("user.meeting");
        let custom_def = KindDef::new("Meeting", props::title())
            .with_icon("📅")
            .with_prop(
                props::title(),
                PropDef::new(ValueType::Text).with_label("Meeting Subject"),
            );
        service
            .register_kind(custom_kind.clone(), custom_def.clone())
            .expect("Failed to register custom kind");

        let updated_kinds = service.get_all_kinds().expect("Failed to get kinds");
        assert!(updated_kinds.iter().any(|(k, _)| k == &custom_kind));

        // 3. Execute command on in-memory graph
        let node_id = NodeId::new();
        let mut node_props = indexmap::IndexMap::new();
        node_props.insert(
            props::title(),
            crate::value::Value::Text("Team Sync".into()),
        );

        let cmd = Command::CreateNode {
            id: node_id,
            kind: custom_kind.clone(),
            parent_id: None,
            index: 0,
            props: node_props,
        };

        let event = service.execute(cmd).expect("Failed to execute command");
        match event {
            Event::NodeCreated { node, .. } => {
                assert_eq!(node.id, node_id);
                assert_eq!(node.kind, custom_kind);
            }
            _ => panic!("Expected NodeCreated event"),
        }

        // 4. In-memory graph query returns node immediately
        let graph = service.load_graph().expect("Failed to load graph");
        assert_eq!(graph.len(), 1);
        let node = graph.get(node_id).expect("Node should exist in memory");
        assert_eq!(node.kind, custom_kind);

        // 5. Delete kind
        service
            .delete_kind(&custom_kind)
            .expect("Failed to delete kind");
        let final_kinds = service.get_all_kinds().expect("Failed to get kinds");
        assert!(!final_kinds.iter().any(|(k, _)| k == &custom_kind));
    }
}

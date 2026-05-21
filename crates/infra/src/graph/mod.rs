

pub mod serializer;

use std::sync::{Arc, RwLock};

use domain::command::Event;
use domain::graph::Graph;

use domain::ports::{GraphRepository, RepositoryError};
use domain::workspace::WorkspaceMeta;

use crate::graph::serializer::{deserialize_graph, serialize_event, serialize_graph, load_meta, save_meta};
use crate::fs::WorkspaceFs;

#[derive(Clone)]
pub struct InMemoryGraphRepository {
    fs: WorkspaceFs,
    cache: Arc<RwLock<Graph>>,
}

impl InMemoryGraphRepository {

    pub fn load(fs: WorkspaceFs) -> Result<Self, RepositoryError> {
        let graph = deserialize_graph(&fs)?;
        Ok(Self {
            fs,
            cache: Arc::new(RwLock::new(graph)),
        })
    }

    pub fn invalidate_cache(&self) -> Result<(), RepositoryError> {
        let graph = deserialize_graph(&self.fs)?;
        let mut cache = self.cache.write().map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
        *cache = graph;
        Ok(())
    }
}

impl GraphRepository for InMemoryGraphRepository {
    fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError> {
        load_meta(&self.fs)
    }

    fn save_meta(&self, meta: &WorkspaceMeta) -> Result<(), RepositoryError> {
        save_meta(&self.fs, meta)
    }

    fn load_graph(&self) -> Result<Graph, RepositoryError> {
        let cache = self.cache.read().map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
        Ok(cache.clone())
    }

    fn apply_event(&self, event: &Event) -> Result<(), RepositoryError> {
        {
            let mut cache = self.cache.write()
                .map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
            apply_event_to_graph(&mut cache, event);
        }

        let cache = self.cache.read()
            .map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
        serialize_event(&self.fs, event, &cache)
    }

    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
        serialize_graph(&self.fs, graph)
    }
}

fn apply_event_to_graph(graph: &mut Graph, event: &Event) {
    match event {
        Event::NodeCreated { node, index } => {
            let node = node.clone();
            if let Some(pid) = node.parent {
                let _ = graph.insert_child(node, pid, *index);
            } else {
                let _ = graph.insert_root(node);
            }
        }
        Event::NodeDeleted { nodes, .. } => {

            if let Some(root) = nodes.first() {
                let _ = graph.remove_subtree(root.id);
            }
        }
        Event::NodeMoved { node_id, new_parent, new_index, .. } => {
            let _ = graph.move_node(*node_id, *new_parent, *new_index);
        }
        Event::PropSet { node_id, key, new_value, .. } => {
            let _ = graph.set_prop(*node_id, key.clone(), new_value.clone());
        }
        Event::PropDeleted { node_id, key, .. } => {
            let _ = graph.delete_prop(*node_id, key);
        }
        Event::PropsSet { node_id, changes } => {
            for (key, new_value, _) in changes {
                let _ = graph.set_prop(*node_id, key.clone(), new_value.clone());
            }
        }
        Event::ViewOverrideSet { node_id, new_view, .. } => {
            if let Some(node) = graph.get_mut(*node_id) {
                node.view_override = new_view.clone();
            }
        }
        Event::KindSet { node_id, new_kind, .. } => {
            if let Some(node) = graph.get_mut(*node_id) {
                node.kind = new_kind.clone();
            }
        }
        Event::Batch(events) => {
            for e in events {
                apply_event_to_graph(graph, e);
            }
        }
    }
}

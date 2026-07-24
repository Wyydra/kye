

pub mod formatters;
pub mod serializer;

use std::sync::{Arc, RwLock};

use domain::command::Event;
use domain::graph::Graph;

use domain::ports::{GraphRepository, RepositoryError};
use domain::workspace::WorkspaceMeta;

use crate::graph::serializer::{deserialize_graph, serialize_event, serialize_graph, load_meta, save_meta, load_tombstones, save_tombstones};
use crate::fs::WorkspaceFs;

use std::collections::HashMap;
use std::path::PathBuf;

#[derive(Clone)]
pub struct InMemoryGraphRepository {
    fs: WorkspaceFs,
    cache: Arc<RwLock<Graph>>,
    path_map: Arc<RwLock<HashMap<domain::primitives::NodeId, PathBuf>>>,
}

impl InMemoryGraphRepository {

    pub fn load(fs: WorkspaceFs) -> Result<Self, RepositoryError> {
        let (graph, path_map) = deserialize_graph(&fs)?;
        Ok(Self {
            fs,
            cache: Arc::new(RwLock::new(graph)),
            path_map: Arc::new(RwLock::new(path_map)),
        })
    }

    pub fn invalidate_cache(&self) -> Result<(), RepositoryError> {
        let (graph, path_map) = deserialize_graph(&self.fs)?;
        let mut cache = self.cache.write().map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
        *cache = graph;
        let mut pm = self.path_map.write().map_err(|_| RepositoryError::Corrupted("Lock poisoned".into()))?;
        *pm = path_map;
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
        serialize_event(&self.fs, event, &cache, &self.path_map)?;

        let mut deleted_ids = Vec::new();
        collect_deleted_node_ids(event, &mut deleted_ids);
        if !deleted_ids.is_empty() {
            let mut tombstones = load_tombstones(&self.fs).unwrap_or_default();
            let now = chrono::Utc::now();
            for id in deleted_ids {
                tombstones.insert(id, now);
            }
            let _ = save_tombstones(&self.fs, &tombstones);
        }

        Ok(())
    }

    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
        serialize_graph(&self.fs, graph, &self.path_map)
    }

    fn load_tombstones(&self) -> Result<std::collections::HashMap<domain::primitives::NodeId, chrono::DateTime<chrono::Utc>>, RepositoryError> {
        load_tombstones(&self.fs)
    }
}

fn collect_deleted_node_ids(event: &Event, ids: &mut Vec<domain::primitives::NodeId>) {
    match event {
        Event::NodeDeleted { nodes, .. } => {
            for n in nodes {
                ids.push(n.id);
            }
        }
        Event::Batch(events) => {
            for e in events {
                collect_deleted_node_ids(e, ids);
            }
        }
        _ => {}
    }
}

fn apply_event_to_graph(graph: &mut Graph, event: &Event) {
    match event {
        Event::NodeCreated { node, parent_id, index } => {
            let node = node.clone();
            if let Some(pid) = parent_id {
                let _ = graph.insert_child(node, *pid, *index);
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

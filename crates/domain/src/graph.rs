

use std::collections::{HashMap, BTreeSet};

use thiserror::Error;

use crate::primitives::{Kind, NodeId, PropKey};
use crate::value::Value;
use crate::node::Node;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum GraphError {
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Cycle detected: {0} is an ancestor of {1}")]
    CycleDetected(NodeId, NodeId),
    #[error("Child index {index} out of bounds (len = {len})")]
    IndexOutOfBounds { index: usize, len: usize },
    #[error("Node {0} already exists")]
    AlreadyExists(NodeId),
}

#[derive(Debug, Clone, Default)]
pub struct Graph {
    nodes: HashMap<NodeId, Node>,

    roots: Vec<NodeId>,

    backlinks: HashMap<NodeId, BTreeSet<NodeId>>,
}

impl Graph {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn get(&self, id: NodeId) -> Option<&Node> {
        self.nodes.get(&id)
    }

    pub fn get_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.get_mut(&id)
    }

    pub fn contains(&self, id: NodeId) -> bool {
        self.nodes.contains_key(&id)
    }

    pub fn roots(&self) -> &[NodeId] {
        &self.roots
    }

    pub fn len(&self) -> usize {
        self.nodes.len()
    }

    pub fn is_empty(&self) -> bool {
        self.nodes.is_empty()
    }

    pub fn iter(&self) -> impl Iterator<Item = &Node> {
        self.nodes.values()
    }

    pub fn children_of(&self, id: NodeId) -> impl Iterator<Item = &Node> {
        self.nodes
            .get(&id)
            .map(|n| n.children.as_slice())
            .unwrap_or(&[])
            .iter()
            .filter_map(|cid| self.nodes.get(cid))
    }

    pub fn ancestors_of(&self, id: NodeId) -> impl Iterator<Item = &Node> + '_ {
        AncestorIter { graph: self, current: self.nodes.get(&id).and_then(|n| n.parent) }
    }

    pub fn subtree_of(&self, id: NodeId) -> Vec<NodeId> {
        let mut result = Vec::new();
        self.collect_subtree(id, &mut result);
        result
    }

    fn collect_subtree(&self, id: NodeId, out: &mut Vec<NodeId>) {
        out.push(id);
        if let Some(node) = self.nodes.get(&id) {
            for &child in &node.children {
                self.collect_subtree(child, out);
            }
        }
    }

    pub fn find_by_kind(&self, kind: &Kind) -> impl Iterator<Item = &Node> {
        let kind = kind.clone();
        self.nodes.values().filter(move |n| n.kind == kind)
    }

    pub fn nearest_ancestor_of_kind(&self, id: NodeId, kind: &Kind) -> Option<&Node> {
        self.ancestors_of(id).find(|n| &n.kind == kind)
    }

    pub fn backlinks(&self, target: NodeId) -> impl Iterator<Item = NodeId> + '_ {
        self.backlinks
            .get(&target)
            .map(|set| set.iter().copied())
            .into_iter()
            .flatten()
    }

    pub fn is_ancestor_of(&self, ancestor: NodeId, node: NodeId) -> bool {
        self.ancestors_of(node).any(|n| n.id == ancestor)
    }

    pub fn insert_root(&mut self, node: Node) -> Result<(), GraphError> {
        let id = node.id;
        if self.nodes.contains_key(&id) {
            return Err(GraphError::AlreadyExists(id));
        }
        self.index_refs(&node);
        self.roots.push(id);
        self.nodes.insert(id, node);
        Ok(())
    }

    pub fn insert_child(&mut self, node: Node, parent_id: NodeId, index: usize) -> Result<(), GraphError> {
        let id = node.id;
        if self.nodes.contains_key(&id) {
            return Err(GraphError::AlreadyExists(id));
        }
        let _len = {
            let parent = self.nodes.get_mut(&parent_id).ok_or(GraphError::NotFound(parent_id))?;
            if index > parent.children.len() {
                return Err(GraphError::IndexOutOfBounds { index, len: parent.children.len() });
            }
            parent.children.insert(index, id);
            parent.children.len()
        };
        self.index_refs(&node);
        self.nodes.insert(id, node);
        self.nodes.get_mut(&id).unwrap().parent = Some(parent_id);
        Ok(())
    }

    pub fn move_node(&mut self, node_id: NodeId, new_parent: Option<NodeId>, index: usize) -> Result<(), GraphError> {
        if !self.nodes.contains_key(&node_id) {
            return Err(GraphError::NotFound(node_id));
        }

        if let Some(pid) = new_parent {
            if !self.nodes.contains_key(&pid) {
                return Err(GraphError::NotFound(pid));
            }
            if pid == node_id || self.is_ancestor_of(node_id, pid) {
                return Err(GraphError::CycleDetected(node_id, pid));
            }
        }

        let old_parent = self.nodes[&node_id].parent;
        match old_parent {
            Some(pid) => {
                if let Some(p) = self.nodes.get_mut(&pid) {
                    p.children.retain(|&c| c != node_id);
                }
            }
            None => {
                self.roots.retain(|&r| r != node_id);
            }
        }

        match new_parent {
            Some(pid) => {
                let parent = self.nodes.get_mut(&pid).unwrap();
                let len = parent.children.len();
                let idx = index.min(len);
                parent.children.insert(idx, node_id);
                self.nodes.get_mut(&node_id).unwrap().parent = Some(pid);
            }
            None => {
                let idx = index.min(self.roots.len());
                self.roots.insert(idx, node_id);
                self.nodes.get_mut(&node_id).unwrap().parent = None;
            }
        }

        Ok(())
    }

    pub fn remove_subtree(&mut self, id: NodeId) -> Result<Vec<Node>, GraphError> {
        if !self.nodes.contains_key(&id) {
            return Err(GraphError::NotFound(id));
        }

        let ids = self.subtree_of(id);

        let old_parent = self.nodes[&id].parent;
        match old_parent {
            Some(pid) => {
                if let Some(p) = self.nodes.get_mut(&pid) {
                    p.children.retain(|&c| c != id);
                }
            }
            None => {
                self.roots.retain(|&r| r != id);
            }
        }

        let mut removed = Vec::with_capacity(ids.len());
        for nid in ids {
            if let Some(node) = self.nodes.remove(&nid) {
                self.deindex_refs(&node);
                removed.push(node);
            }
        }

        Ok(removed)
    }

    pub fn set_prop(&mut self, node_id: NodeId, key: PropKey, value: Value) -> Result<Option<Value>, GraphError> {
        let node = self.nodes.get_mut(&node_id).ok_or(GraphError::NotFound(node_id))?;

        if let Some(old) = node.props.get(&key) {
            let mut old_refs = Vec::new();
            old.collect_refs(&mut old_refs);
            for r in old_refs {
                if let Some(set) = self.backlinks.get_mut(&r) {
                    set.remove(&node_id);
                    if set.is_empty() {
                        self.backlinks.remove(&r);
                    }
                }
            }
        }

        let mut new_refs = Vec::new();
        value.collect_refs(&mut new_refs);
        for r in new_refs {
            self.backlinks.entry(r).or_default().insert(node_id);
        }

        let old = node.props.insert(key, value);
        Ok(old)
    }

    pub fn delete_prop(&mut self, node_id: NodeId, key: &PropKey) -> Result<Option<Value>, GraphError> {
        let node = self.nodes.get_mut(&node_id).ok_or(GraphError::NotFound(node_id))?;

        if let Some(old) = node.props.get(key) {
            let mut refs = Vec::new();
            old.collect_refs(&mut refs);

            let refs = refs;
            let _ = node;
            for r in refs {
                if let Some(set) = self.backlinks.get_mut(&r) {
                    set.remove(&node_id);
                    if set.is_empty() {
                        self.backlinks.remove(&r);
                    }
                }
            }
            let node = self.nodes.get_mut(&node_id).unwrap();
            return Ok(node.props.shift_remove(key));
        }

        Ok(None)
    }

    fn index_refs(&mut self, node: &Node) {
        let id = node.id;
        for value in node.props.values() {
            let mut refs = Vec::new();
            value.collect_refs(&mut refs);
            for r in refs {
                self.backlinks.entry(r).or_default().insert(id);
            }
        }
    }

    fn deindex_refs(&mut self, node: &Node) {
        let id = node.id;
        for value in node.props.values() {
            let mut refs = Vec::new();
            value.collect_refs(&mut refs);
            for r in refs {
                if let Some(set) = self.backlinks.get_mut(&r) {
                    set.remove(&id);
                    if set.is_empty() {
                        self.backlinks.remove(&r);
                    }
                }
            }
        }
    }
}

struct AncestorIter<'a> {
    graph: &'a Graph,
    current: Option<NodeId>,
}

impl<'a> Iterator for AncestorIter<'a> {
    type Item = &'a Node;

    fn next(&mut self) -> Option<Self::Item> {
        let id = self.current?;
        let node = self.graph.nodes.get(&id)?;
        self.current = node.parent;
        Some(node)
    }
}

use std::collections::{HashMap, HashSet};
use thiserror::Error;

use crate::node::Node;
use crate::primitives::{EdgeKind, Kind, NodeId, PropKey};
use crate::value::Value;

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
    /// Primary Node storage: NodeId -> Node entity
    nodes: HashMap<NodeId, Node>,
    /// Root node IDs (nodes with no parent)
    roots: Vec<NodeId>,
    /// Outgoing edge index: Source NodeId -> List of (Target NodeId, EdgeKind)
    outgoing: HashMap<NodeId, Vec<(NodeId, EdgeKind)>>,
    /// Incoming edge index: Target NodeId -> Set of (Source NodeId, EdgeKind)
    incoming: HashMap<NodeId, HashSet<(NodeId, EdgeKind)>>,
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
        let mut children: Vec<(usize, NodeId)> = Vec::new();
        if let Some(edges) = self.outgoing.get(&id) {
            for (target, kind) in edges {
                if let EdgeKind::ParentChild { index } = kind {
                    children.push((*index, *target));
                }
            }
        }
        children.sort_by_key(|(idx, _)| *idx);
        children.into_iter().filter_map(move |(_, cid)| self.nodes.get(&cid))
    }

    pub fn parent_of(&self, id: NodeId) -> Option<NodeId> {
        if let Some(edges) = self.incoming.get(&id) {
            for (source, kind) in edges {
                if matches!(kind, EdgeKind::ParentChild { .. }) {
                    return Some(*source);
                }
            }
        }
        None
    }

    pub fn ancestors_of(&self, id: NodeId) -> impl Iterator<Item = &Node> + '_ {
        AncestorIter {
            graph: self,
            current: self.parent_of(id),
        }
    }

    pub fn subtree_of(&self, id: NodeId) -> Vec<NodeId> {
        let mut result = Vec::new();
        self.collect_subtree(id, &mut result);
        result
    }

    fn collect_subtree(&self, id: NodeId, out: &mut Vec<NodeId>) {
        out.push(id);
        let children: Vec<NodeId> = self.children_of(id).map(|n| n.id).collect();
        for child in children {
            self.collect_subtree(child, out);
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
        let mut sources = Vec::new();
        if let Some(edges) = self.incoming.get(&target) {
            for (source, kind) in edges {
                if matches!(kind, EdgeKind::Reference | EdgeKind::Property { .. }) {
                    sources.push(*source);
                }
            }
        }
        sources.into_iter()
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

    pub fn insert_child(
        &mut self,
        node: Node,
        parent_id: NodeId,
        index: usize,
    ) -> Result<(), GraphError> {
        let id = node.id;
        if self.nodes.contains_key(&id) {
            return Err(GraphError::AlreadyExists(id));
        }
        if !self.nodes.contains_key(&parent_id) {
            return Err(GraphError::NotFound(parent_id));
        }

        let current_children_count = self.children_of(parent_id).count();
        if index > current_children_count {
            return Err(GraphError::IndexOutOfBounds {
                index,
                len: current_children_count,
            });
        }

        if let Some(edges) = self.outgoing.get_mut(&parent_id) {
            for (_, kind) in edges.iter_mut() {
                if let EdgeKind::ParentChild { index: idx } = kind
                    && *idx >= index
                {
                    *idx += 1;
                }
            }
        }

        let edge_kind = EdgeKind::ParentChild { index };
        self.outgoing
            .entry(parent_id)
            .or_default()
            .push((id, edge_kind.clone()));
        self.incoming
            .entry(id)
            .or_default()
            .insert((parent_id, edge_kind));

        self.index_refs(&node);
        self.nodes.insert(id, node);
        Ok(())
    }

    pub fn move_node(
        &mut self,
        node_id: NodeId,
        new_parent: Option<NodeId>,
        index: usize,
    ) -> Result<(), GraphError> {
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

        if let Some(old_parent) = self.parent_of(node_id) {
            if let Some(edges) = self.outgoing.get_mut(&old_parent) {
                let mut old_idx_opt = None;
                for (target, kind) in edges.iter() {
                    if *target == node_id
                        && let EdgeKind::ParentChild { index: idx } = kind
                    {
                        old_idx_opt = Some(*idx);
                    }
                }
                edges.retain(|(target, kind)| {
                    !(*target == node_id && matches!(kind, EdgeKind::ParentChild { .. }))
                });
                if let Some(old_idx) = old_idx_opt {
                    for (_, kind) in edges.iter_mut() {
                        if let EdgeKind::ParentChild { index: c_idx } = kind
                            && *c_idx > old_idx
                        {
                            *c_idx -= 1;
                        }
                    }
                }
            }
            if let Some(incoming_set) = self.incoming.get_mut(&node_id) {
                incoming_set.retain(|(source, kind)| {
                    !(*source == old_parent && matches!(kind, EdgeKind::ParentChild { .. }))
                });
            }
        } else {
            self.roots.retain(|&r| r != node_id);
        }

        match new_parent {
            Some(pid) => {
                let children_count = self.children_of(pid).count();
                let idx = index.min(children_count);

                if let Some(edges) = self.outgoing.get_mut(&pid) {
                    for (_, kind) in edges.iter_mut() {
                        if let EdgeKind::ParentChild { index: c_idx } = kind
                            && *c_idx >= idx
                        {
                            *c_idx += 1;
                        }
                    }
                }

                let edge_kind = EdgeKind::ParentChild { index: idx };
                self.outgoing
                    .entry(pid)
                    .or_default()
                    .push((node_id, edge_kind.clone()));
                self.incoming
                    .entry(node_id)
                    .or_default()
                    .insert((pid, edge_kind));
            }
            None => {
                let idx = index.min(self.roots.len());
                self.roots.insert(idx, node_id);
            }
        }

        Ok(())
    }

    pub fn remove_subtree(&mut self, id: NodeId) -> Result<Vec<Node>, GraphError> {
        if !self.nodes.contains_key(&id) {
            return Err(GraphError::NotFound(id));
        }

        let ids = self.subtree_of(id);

        if let Some(pid) = self.parent_of(id) {
            if let Some(edges) = self.outgoing.get_mut(&pid) {
                edges.retain(|(target, kind)| {
                    !(*target == id && matches!(kind, EdgeKind::ParentChild { .. }))
                });
            }
            if let Some(incoming_set) = self.incoming.get_mut(&id) {
                incoming_set.retain(|(source, kind)| {
                    !(*source == pid && matches!(kind, EdgeKind::ParentChild { .. }))
                });
            }
        } else {
            self.roots.retain(|&r| r != id);
        }

        let mut removed = Vec::with_capacity(ids.len());
        for nid in ids {
            self.outgoing.remove(&nid);
            self.incoming.remove(&nid);
            if let Some(node) = self.nodes.remove(&nid) {
                self.deindex_refs(&node);
                removed.push(node);
            }
        }

        Ok(removed)
    }

    pub fn set_prop(
        &mut self,
        node_id: NodeId,
        key: PropKey,
        value: Value,
    ) -> Result<Option<Value>, GraphError> {
        let node = self
            .nodes
            .get_mut(&node_id)
            .ok_or(GraphError::NotFound(node_id))?;

        if let Some(old) = node.props.get(&key) {
            let mut old_refs = Vec::new();
            old.collect_refs(&mut old_refs);
            for r in old_refs {
                let edge_ref = EdgeKind::Reference;
                let edge_prop = EdgeKind::Property { key: key.clone() };
                if let Some(edges) = self.outgoing.get_mut(&node_id) {
                    edges.retain(|(target, kind)| {
                        !(*target == r && (*kind == edge_ref || *kind == edge_prop))
                    });
                }
                if let Some(set) = self.incoming.get_mut(&r) {
                    set.retain(|(source, kind)| {
                        !(*source == node_id && (*kind == edge_ref || *kind == edge_prop))
                    });
                }
            }
        }

        let mut new_refs = Vec::new();
        value.collect_refs(&mut new_refs);
        for r in new_refs {
            let edge_ref = EdgeKind::Reference;
            self.outgoing
                .entry(node_id)
                .or_default()
                .push((r, edge_ref.clone()));
            self.incoming
                .entry(r)
                .or_default()
                .insert((node_id, edge_ref));
        }

        let old = node.props.insert(key, value);
        Ok(old)
    }

    pub fn delete_prop(
        &mut self,
        node_id: NodeId,
        key: &PropKey,
    ) -> Result<Option<Value>, GraphError> {
        let node = self
            .nodes
            .get_mut(&node_id)
            .ok_or(GraphError::NotFound(node_id))?;

        if let Some(old) = node.props.get(key) {
            let mut refs = Vec::new();
            old.collect_refs(&mut refs);
            for r in refs {
                let edge_ref = EdgeKind::Reference;
                let edge_prop = EdgeKind::Property { key: key.clone() };
                if let Some(edges) = self.outgoing.get_mut(&node_id) {
                    edges.retain(|(target, kind)| {
                        !(*target == r && (*kind == edge_ref || *kind == edge_prop))
                    });
                }
                if let Some(set) = self.incoming.get_mut(&r) {
                    set.retain(|(source, kind)| {
                        !(*source == node_id && (*kind == edge_ref || *kind == edge_prop))
                    });
                }
            }
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
                let edge_ref = EdgeKind::Reference;
                self.outgoing
                    .entry(id)
                    .or_default()
                    .push((r, edge_ref.clone()));
                self.incoming
                    .entry(r)
                    .or_default()
                    .insert((id, edge_ref));
            }
        }
    }

    fn deindex_refs(&mut self, node: &Node) {
        let id = node.id;
        for value in node.props.values() {
            let mut refs = Vec::new();
            value.collect_refs(&mut refs);
            for r in refs {
                if let Some(edges) = self.outgoing.get_mut(&id) {
                    edges.retain(|(target, _)| *target != r);
                }
                if let Some(set) = self.incoming.get_mut(&r) {
                    set.retain(|(source, _)| *source != id);
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
        self.current = self.graph.parent_of(id);
        Some(node)
    }
}

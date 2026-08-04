use crate::graph::Graph;
use crate::node::Node;
use crate::primitives::{Kind, NodeId, PropKey};
use crate::value::Value;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SortDir {
    Asc,
    Desc,
}

#[derive(Default)]
pub struct QueryBuilder {
    kind_filter: Option<Kind>,
    tag_filter: Option<String>,
    prop_eq: Vec<(PropKey, Value)>,
    prop_bool: Vec<(PropKey, bool)>,
    prop_contains: Vec<(PropKey, String)>,
    ancestor_filter: Option<NodeId>,
    sort_by: Option<(PropKey, SortDir)>,
    limit: Option<usize>,
}

impl QueryBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn kind(mut self, kind: impl Into<Kind>) -> Self {
        self.kind_filter = Some(kind.into());
        self
    }

    pub fn tag(mut self, tag: impl Into<String>) -> Self {
        self.tag_filter = Some(tag.into());
        self
    }

    pub fn prop_eq(mut self, key: impl Into<PropKey>, value: Value) -> Self {
        self.prop_eq.push((key.into(), value));
        self
    }

    pub fn prop_bool(mut self, key: impl Into<PropKey>, expected: bool) -> Self {
        self.prop_bool.push((key.into(), expected));
        self
    }

    pub fn prop_contains(mut self, key: impl Into<PropKey>, substr: impl Into<String>) -> Self {
        self.prop_contains.push((key.into(), substr.into()));
        self
    }

    pub fn ancestor(mut self, ancestor_id: NodeId) -> Self {
        self.ancestor_filter = Some(ancestor_id);
        self
    }

    pub fn sort_by(mut self, key: impl Into<PropKey>, dir: SortDir) -> Self {
        self.sort_by = Some((key.into(), dir));
        self
    }

    pub fn limit(mut self, n: usize) -> Self {
        self.limit = Some(n);
        self
    }

    pub fn execute(self, graph: &Graph) -> Vec<NodeId> {
        let candidates: Vec<NodeId> = match self.ancestor_filter {
            Some(ancestor_id) => graph
                .subtree_of(ancestor_id)
                .into_iter()
                .filter(|&id| id != ancestor_id)
                .collect(),
            None => graph.iter().map(|n| n.id).collect(),
        };

        let mut results: Vec<&Node> = candidates
            .iter()
            .filter_map(|&id| graph.get(id))
            .filter(|node| self.matches(node))
            .collect();

        if let Some((ref key, ref dir)) = self.sort_by {
            results.sort_by(|a, b| {
                let va = a.props.get(key).and_then(|v| v.as_text()).unwrap_or("");
                let vb = b.props.get(key).and_then(|v| v.as_text()).unwrap_or("");
                let ord = va.cmp(vb);
                if *dir == SortDir::Desc {
                    ord.reverse()
                } else {
                    ord
                }
            });
        }

        let results: Vec<NodeId> = results.iter().map(|n| n.id).collect();
        match self.limit {
            Some(n) => results.into_iter().take(n).collect(),
            None => results,
        }
    }

    fn matches(&self, node: &Node) -> bool {
        if let Some(ref k) = self.kind_filter
            && &node.kind != k
        {
            return false;
        }

        if let Some(ref tag) = self.tag_filter {
            let has_tag = node
                .prop("tag")
                .and_then(|v| v.as_text())
                .map(|t| t == tag.as_str())
                .unwrap_or(false);
            if !has_tag {
                return false;
            }
        }

        for (key, expected) in &self.prop_eq {
            match node.props.get(key) {
                Some(v) if v == expected => {}
                _ => return false,
            }
        }

        for (key, expected) in &self.prop_bool {
            match node.prop_bool(key.as_str()) {
                Some(v) if v == *expected => {}
                _ => return false,
            }
        }

        for (key, substr) in &self.prop_contains {
            let found = node
                .props
                .get(key)
                .and_then(|v| v.as_text())
                .map(|t| t.contains(substr.as_str()))
                .unwrap_or(false);
            if !found {
                return false;
            }
        }

        true
    }
}

pub fn evaluate_query_node(graph: &Graph, query_node_id: NodeId) -> Vec<NodeId> {
    let node = match graph.get(query_node_id) {
        Some(n) => n,
        None => return Vec::new(),
    };

    let mut builder = QueryBuilder::new();

    if let Some(kind_str) = node.prop_text("kind_filter") {
        builder = builder.kind(kind_str);
    }
    if let Some(tag) = node.prop_text("tag_filter") {
        builder = builder.tag(tag);
    }
    if let Some(limit) = node.prop_int("limit") {
        builder = builder.limit(limit as usize);
    }

    builder.execute(graph)
}

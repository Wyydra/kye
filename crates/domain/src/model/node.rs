use chrono::{DateTime, Utc};

use crate::primitives::{Kind, NodeId, PropKey};
use crate::value::{Props, Value};
use crate::view::ViewDef;

#[derive(Debug, Clone)]
pub struct Node {
    pub id: NodeId,
    pub kind: Kind,
    pub props: Props,

    pub view_override: Option<ViewDef>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl std::fmt::Display for Node {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Node({} [{}])", self.id.short(), self.kind)?;
        if !self.props.is_empty() {
            write!(f, " ")?;
            crate::value::format_props(&self.props, f)?;
        }
        Ok(())
    }
}

impl Node {
    pub fn new(id: NodeId, kind: impl Into<Kind>, now: DateTime<Utc>) -> Self {
        Self {
            id,
            kind: kind.into(),
            props: Props::new(),
            view_override: None,
            created_at: now,
            updated_at: now,
        }
    }

    pub fn builder(kind: impl Into<Kind>, now: DateTime<Utc>) -> NodeBuilder {
        NodeBuilder::new(kind, now)
    }

    pub fn prop(&self, key: &str) -> Option<&Value> {
        self.props.get(&PropKey::from(key))
    }

    pub fn prop_text(&self, key: &str) -> Option<&str> {
        self.prop(key)?.as_text()
    }

    pub fn prop_bool(&self, key: &str) -> Option<bool> {
        self.prop(key)?.as_bool()
    }

    pub fn prop_int(&self, key: &str) -> Option<i64> {
        self.prop(key)?.as_int()
    }

    pub fn prop_ref(&self, key: &str) -> Option<NodeId> {
        self.prop(key)?.as_ref_id()
    }

    pub fn title(&self) -> Option<&str> {
        self.prop_text("title")
    }

    pub fn set_prop(&mut self, key: impl Into<PropKey>, value: Value, now: DateTime<Utc>) {
        self.props.insert(key.into(), value);
        self.touch(now);
    }

    pub fn delete_prop(&mut self, key: &PropKey, now: DateTime<Utc>) -> Option<Value> {
        let old = self.props.swap_remove(key);
        self.touch(now);
        old
    }

    pub fn set_view_override(&mut self, view: Option<ViewDef>, now: DateTime<Utc>) {
        self.view_override = view;
        self.touch(now);
    }

    pub fn set_kind(&mut self, new_kind: impl Into<Kind>, now: DateTime<Utc>) {
        self.kind = new_kind.into();
        self.touch(now);
    }

    pub fn touch(&mut self, now: DateTime<Utc>) {
        if now >= self.created_at {
            self.updated_at = now;
        } else {
            self.updated_at = self.created_at;
        }
    }
}

pub struct NodeBuilder {
    id: NodeId,
    kind: Kind,
    props: Props,
    view_override: Option<ViewDef>,
    now: DateTime<Utc>,
}

impl NodeBuilder {
    pub fn new(kind: impl Into<Kind>, now: DateTime<Utc>) -> Self {
        Self {
            id: NodeId::new(),
            kind: kind.into(),
            props: Props::new(),
            view_override: None,
            now,
        }
    }

    pub fn with_id(mut self, id: NodeId) -> Self {
        self.id = id;
        self
    }

    pub fn with_prop(mut self, key: impl Into<crate::primitives::PropKey>, value: Value) -> Self {
        self.props.insert(key.into(), value);
        self
    }

    pub fn with_props(mut self, props: Props) -> Self {
        self.props = props;
        self
    }

    pub fn with_view_override(mut self, view: ViewDef) -> Self {
        self.view_override = Some(view);
        self
    }

    pub fn build(self) -> Node {
        Node {
            id: self.id,
            kind: self.kind,
            props: self.props,
            view_override: self.view_override,
            created_at: self.now,
            updated_at: self.now,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_node_invariants_and_mutation() {
        let t0 = Utc::now();
        let mut node = Node::new(NodeId::new(), "core.task", t0);
        assert_eq!(node.created_at, t0);
        assert_eq!(node.updated_at, t0);

        let t1 = t0 + Duration::seconds(10);
        node.set_prop("title", Value::Text("Task 1".into()), t1);
        assert_eq!(node.updated_at, t1);
        assert_eq!(node.title(), Some("Task 1"));

        // Invariant: touch with past time cannot set updated_at before created_at
        let past = t0 - Duration::seconds(100);
        node.touch(past);
        assert_eq!(node.updated_at, node.created_at);
    }
}

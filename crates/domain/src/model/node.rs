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

impl Node {
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

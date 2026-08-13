use std::fmt;
use std::sync::Arc;
use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::primitives::{Kind, NodeId, PropKey};

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize,
)]
pub struct WidgetName(Arc<str>);

impl WidgetName {
    pub fn new(s: impl AsRef<str>) -> Self {
        Self(Arc::from(s.as_ref()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for WidgetName {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for WidgetName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize,
)]
pub struct DiagramKind(Arc<str>);

impl DiagramKind {
    pub fn new(s: impl AsRef<str>) -> Self {
        Self(Arc::from(s.as_ref()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for DiagramKind {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for DiagramKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize,
)]
pub struct SlotName(Arc<str>);

impl SlotName {
    pub fn new(s: impl AsRef<str>) -> Self {
        Self(Arc::from(s.as_ref()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for SlotName {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for SlotName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize,
)]
pub struct ActionId(Arc<str>);

impl ActionId {
    pub fn new(s: impl AsRef<str>) -> Self {
        Self(Arc::from(s.as_ref()))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for ActionId {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for ActionId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ViewDef {
    pub surface: Surface,
    pub source: DataSource,
    pub overlay: ViewOverlay,
    pub bindings: IndexMap<SlotName, PropKey>,
    pub actions: Vec<ActionDef>,
}

impl ViewDef {
    pub fn new(surface: Surface) -> Self {
        Self {
            surface,
            source: DataSource::DirectChildren,
            overlay: ViewOverlay::default(),
            bindings: IndexMap::new(),
            actions: Vec::new(),
        }
    }

    pub fn with_source(mut self, source: DataSource) -> Self {
        self.source = source;
        self
    }

    pub fn with_overlay(mut self, overlay: ViewOverlay) -> Self {
        self.overlay = overlay;
        self
    }

    pub fn with_binding(mut self, slot: impl Into<SlotName>, prop: impl Into<PropKey>) -> Self {
        self.bindings.insert(slot.into(), prop.into());
        self
    }

    pub fn with_action(mut self, action: ActionDef) -> Self {
        self.actions.push(action);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Surface {
    Document {
        layout: DocumentLayout,
    },
    Canvas {
        layout: CanvasLayout,
        diagram_kind: Option<DiagramKind>,
    },
    Collection {
        layout: CollectionLayout,
    },
    Widget {
        name: WidgetName,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DocumentLayout {
    VerticalStream,
    Columns { count: u8 },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CanvasLayout {
    Absolute,
    AutoTree,
    ForceDirected,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum CollectionLayout {
    Table { columns: Vec<PropKey> },
    Kanban { group_by: PropKey },
    Gallery,
    List,
    Matrix { edge_kind: Kind },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DataSource {
    DirectChildren,
    PersistedQuery {
        query_node_id: NodeId,
    },
    DualQuery {
        row_query_node_id: NodeId,
        col_query_node_id: NodeId,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct ViewOverlay {
    pub hidden_edge_kinds: Vec<Kind>,
    pub focus_node_id: Option<NodeId>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ActionDef {
    pub id: ActionId,
    pub label: String,
    pub kind: ActionKind,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ActionKind {
    ToggleProp { prop: PropKey },
    NavigateTo { node_id: NodeId },
    Custom { name: String },
}

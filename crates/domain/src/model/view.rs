

use indexmap::IndexMap;
use crate::primitives::PropKey;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ViewDef {
    pub layout: Layout,

    pub bindings: IndexMap<String, PropKey>,
    pub actions: Vec<ActionDef>,
}

impl ViewDef {
    pub fn new(layout: Layout) -> Self {
        Self {
            layout,
            bindings: IndexMap::new(),
            actions: Vec::new(),
        }
    }

    pub fn with_binding(mut self, slot: &str, prop: impl Into<PropKey>) -> Self {
        self.bindings.insert(slot.to_string(), prop.into());
        self
    }

    pub fn with_action(mut self, action: ActionDef) -> Self {
        self.actions.push(action);
        self
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Layout {

    Document,

    Canvas,

    Grid { columns: u32 },

    Stack { direction: Direction },

    Gallery,

    Table,

    Kanban { group_by: PropKey },

    Widget { name: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Direction {
    Vertical,
    Horizontal,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionDef {
    pub id: String,
    pub label: String,
    pub kind: ActionKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionKind {

    ToggleProp { prop: PropKey },

    NavigateTo { node_id: crate::primitives::NodeId },

    Custom { name: String },
}

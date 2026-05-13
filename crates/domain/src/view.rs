//! ViewDef — métadonnées de rendu d'un node.
//! Attaché à un `KindDef` (défaut) ou en override sur un `Node` (préférence).

use indexmap::IndexMap;
use crate::primitives::PropKey;

// ── ViewDef ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ViewDef {
    pub layout: Layout,
    /// Map slot → prop : dit au GUI quelle prop passer à quel slot de rendu.
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

// ── Layout ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Layout {
    /// Contenu de page — enfants affichés verticalement comme blocs.
    Document,
    /// Toile libre — enfants positionnés avec coordonnées.
    Canvas,
    /// Grille avec N colonnes.
    Grid { columns: u32 },
    /// Pile avec direction.
    Stack { direction: Direction },
    /// Galerie d'images ou de cards.
    Gallery,
    /// Tableau avec colonnes définies par des nodes `core.column`.
    Table,
    /// Vue Kanban groupée par une prop.
    Kanban { group_by: PropKey },
    /// Délègue le rendu au renderer GUI nommé.
    /// Le domain ne sait pas ce qu'est un flip de flashcard.
    Widget { name: String },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Direction {
    Vertical,
    Horizontal,
}

// ── ActionDef ─────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionDef {
    pub id: String,
    pub label: String,
    pub kind: ActionKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ActionKind {
    /// Toggle une prop booléenne.
    ToggleProp { prop: PropKey },
    /// Navigation vers un node.
    NavigateTo { node_id: crate::primitives::NodeId },
    /// Action nommée déléguée au GUI.
    Custom { name: String },
}

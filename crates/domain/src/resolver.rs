//! SchemaResolver — résolution du schéma effectif d'un node selon son contexte.
//! Responsabilité unique : tenir compte de la hiérarchie du graphe pour
//! résoudre les contraintes héritées (ex : colonnes d'une database parente).

use thiserror::Error;

use crate::graph::Graph;
use crate::node::Node;
use crate::primitives::{NodeId, kinds};
use crate::registry::KindRegistry;
use crate::schema::ValidationError;

// ── Erreurs ───────────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum ResolverError {
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Validation failed: {0:?}")]
    Validation(Vec<ValidationError>),
}

// ── SchemaResolver ────────────────────────────────────────────────────────────

pub struct SchemaResolver<'a> {
    graph: &'a Graph,
    registry: &'a KindRegistry,
}

impl<'a> SchemaResolver<'a> {
    pub fn new(graph: &'a Graph, registry: &'a KindRegistry) -> Self {
        Self { graph, registry }
    }

    /// Si le node est un `core.row`, remonte au parent `core.database`
    /// et retourne ses enfants `core.column`. C'est le schéma hérité.
    pub fn effective_columns(&self, row_id: NodeId) -> Vec<&Node> {
        let row = match self.graph.get(row_id) {
            Some(n) => n,
            None => return Vec::new(),
        };

        // Le row doit être un core.row
        if row.kind != kinds::row() {
            return Vec::new();
        }

        // Remonter au parent core.database
        let db = self.graph.nearest_ancestor_of_kind(row_id, &kinds::database());
        match db {
            Some(db_node) => {
                // Les colonnes sont les enfants core.column de la database
                self.graph
                    .children_of(db_node.id)
                    .filter(|n| n.kind == kinds::column())
                    .collect()
            }
            None => Vec::new(),
        }
    }

    /// Validation complète d'un node dans son contexte :
    ///   1. Validation KindDef (champs requis, types)
    ///   2. Validation schéma hérité (colonnes requises de la DB parente)
    pub fn validate_in_context(&self, node_id: NodeId) -> Result<(), ResolverError> {
        let node = self.graph.get(node_id).ok_or(ResolverError::NotFound(node_id))?;

        // 1. Validation KindDef
        let mut errors = self.registry.validate_node(node);

        // 2. Validation schéma hérité pour les rows
        if node.kind == kinds::row() {
            let columns = self.effective_columns(node_id);
            for col in columns {
                if let Some(col_title) = col.prop_text("title") {
                    // La colonne est requise si son KindDef le dit (simplified: toujours)
                    if node.prop(col_title).is_none() {
                        errors.push(ValidationError::MissingRequiredProp(
                            crate::primitives::PropKey::from(col_title)
                        ));
                    }
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(ResolverError::Validation(errors))
        }
    }
}

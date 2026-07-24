

use thiserror::Error;

use crate::graph::Graph;
use crate::node::Node;
use crate::primitives::{NodeId, kinds};
use crate::registry::KindRegistry;
use crate::schema::ValidationError;

#[derive(Debug, Error)]
pub enum ResolverError {
    #[error("Node {0} not found")]
    NotFound(NodeId),
    #[error("Validation failed: {0:?}")]
    Validation(Vec<ValidationError>),
}

pub struct SchemaResolver<'a> {
    graph: &'a Graph,
    registry: &'a KindRegistry,
}

impl<'a> SchemaResolver<'a> {
    pub fn new(graph: &'a Graph, registry: &'a KindRegistry) -> Self {
        Self { graph, registry }
    }

    pub fn effective_columns(&self, row_id: NodeId) -> Vec<&Node> {
        let row = match self.graph.get(row_id) {
            Some(n) => n,
            None => return Vec::new(),
        };

        if row.kind != kinds::row() {
            return Vec::new();
        }

        let db = self.graph.nearest_ancestor_of_kind(row_id, &kinds::database());
        match db {
            Some(db_node) => {

                self.graph
                    .children_of(db_node.id)
                    .filter(|n| n.kind == kinds::column())
                    .collect()
            }
            None => Vec::new(),
        }
    }

    pub fn validate_in_context(&self, node_id: NodeId) -> Result<(), ResolverError> {
        let node = self.graph.get(node_id).ok_or(ResolverError::NotFound(node_id))?;

        let mut errors = self.registry.validate_node(node);

        if node.kind == kinds::row() {
            let columns = self.effective_columns(node_id);
            for col in columns {
                if let Some(col_title) = col.prop_text("title") {

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

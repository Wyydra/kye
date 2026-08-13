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

        let db = self
            .graph
            .nearest_ancestor_of_kind(row_id, &kinds::database());
        match db {
            Some(db_node) => self
                .graph
                .children_of(db_node.id)
                .filter(|n| n.kind == kinds::column())
                .collect(),
            None => Vec::new(),
        }
    }

    pub fn validate_in_context(&self, node_id: NodeId) -> Result<(), ResolverError> {
        let node = self
            .graph
            .get(node_id)
            .ok_or(ResolverError::NotFound(node_id))?;

        let mut errors = self.registry.validate_node(node);

        if node.kind == kinds::row() {
            let columns = self.effective_columns(node_id);
            for col in columns {
                if let Some(col_title) = col.prop_text("title")
                    && node.prop(col_title).is_none()
                {
                    errors.push(ValidationError::MissingRequiredProp(
                        crate::primitives::PropKey::from(col_title),
                    ));
                }
            }
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(ResolverError::Validation(errors))
        }
    }

    pub fn validate_connection(&self, connection_id: NodeId) -> Result<(), ResolverError> {
        let conn_node = self
            .graph
            .get(connection_id)
            .ok_or(ResolverError::NotFound(connection_id))?;

        let mut errors = self.registry.validate_node(conn_node);

        let from_id = conn_node.prop_ref("from");
        let to_id = conn_node.prop_ref("to");

        if let (Some(fid), Some(tid)) = (from_id, to_id) {
            let from_node = self.graph.get(fid);
            let to_node = self.graph.get(tid);

            if let Some(conn_def) = self.registry.get(&conn_node.kind) {
                for c in &conn_def.constraints {
                    match c {
                        crate::schema::Constraint::ConnectionSourceKinds(allowed) => {
                            if let Some(source) = from_node {
                                if !allowed.contains(&source.kind) {
                                    errors.push(ValidationError::ConstraintViolation(format!(
                                        "Source node {} ({}) is not allowed for connection {}",
                                        source.id.short(),
                                        source.kind,
                                        conn_node.kind
                                    )));
                                }
                            }
                        }
                        crate::schema::Constraint::ConnectionTargetKinds(allowed) => {
                            if let Some(target) = to_node {
                                if !allowed.contains(&target.kind) {
                                    errors.push(ValidationError::ConstraintViolation(format!(
                                        "Target node {} ({}) is not allowed for connection {}",
                                        target.id.short(),
                                        target.kind,
                                        conn_node.kind
                                    )));
                                }
                            }
                        }
                        _ => {}
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use crate::primitives::Kind;
    use crate::schema::{Constraint, KindDef};
    use crate::value::Value;

    #[test]
    fn test_validate_connection_constraints() {
        let mut registry = KindRegistry::new();
        let state_kind = Kind::from("mbse.state");
        let transition_kind = Kind::from("mbse.transition");
        let task_kind = Kind::from("core.task");

        let transition_def = KindDef::new("Transition", "title")
            .with_constraint(Constraint::ConnectionSourceKinds(vec![state_kind.clone()]))
            .with_constraint(Constraint::ConnectionTargetKinds(vec![state_kind.clone()]));

        registry.register(transition_kind.clone(), transition_def);

        let mut graph = Graph::new();
        let now = Utc::now();

        let state1_id = NodeId::new();
        let state1 = Node::new(state1_id, state_kind.clone(), now);
        graph.insert_root(state1).unwrap();

        let task_id = NodeId::new();
        let task = Node::new(task_id, task_kind.clone(), now);
        graph.insert_root(task).unwrap();

        // 1. Invalid connection (task -> state1)
        let conn_invalid_id = NodeId::new();
        let mut conn_invalid = Node::new(conn_invalid_id, transition_kind.clone(), now);
        conn_invalid.set_prop("from", Value::Ref(task_id), now);
        conn_invalid.set_prop("to", Value::Ref(state1_id), now);
        graph.insert_root(conn_invalid).unwrap();

        let resolver = SchemaResolver::new(&graph, &registry);
        assert!(resolver.validate_connection(conn_invalid_id).is_err());

        // 2. Valid connection (state1 -> state1 loop)
        let conn_valid_id = NodeId::new();
        let mut conn_valid = Node::new(conn_valid_id, transition_kind.clone(), now);
        conn_valid.set_prop("from", Value::Ref(state1_id), now);
        conn_valid.set_prop("to", Value::Ref(state1_id), now);
        graph.insert_root(conn_valid).unwrap();

        let resolver = SchemaResolver::new(&graph, &registry);
        assert!(resolver.validate_connection(conn_valid_id).is_ok());
    }
}

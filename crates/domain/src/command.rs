

use chrono::{DateTime, Utc};
use thiserror::Error;

use crate::graph::{Graph, GraphError};
use crate::node::{Node, NodeBuilder};
use crate::primitives::{Kind, NodeId, PropKey};
use crate::registry::KindRegistry;
use crate::schema::ValidationError;
use crate::value::{Props, Value};
use crate::view::ViewDef;

#[derive(Debug, Error)]
pub enum CommandError {
    #[error("Graph error: {0}")]
    Graph(#[from] GraphError),
    #[error("Validation failed: {0:?}")]
    Validation(Vec<ValidationError>),
    #[error("Node {0} not found")]
    NotFound(NodeId),
}

#[derive(Debug, Clone)]
pub enum Command {
    CreateNode {
        id: NodeId,
        kind: Kind,
        parent_id: Option<NodeId>,

        index: usize,
        props: Props,
    },
    DeleteNode {
        id: NodeId,

        cascade: bool,
    },
    MoveNode {
        node_id: NodeId,
        new_parent_id: Option<NodeId>,
        new_index: usize,
    },
    SetProp {
        node_id: NodeId,
        key: PropKey,
        value: Value,
    },
    DeleteProp {
        node_id: NodeId,
        key: PropKey,
    },

    SetProps {
        node_id: NodeId,
        props: Props,
    },
    SetViewOverride {
        node_id: NodeId,
        view: Option<ViewDef>,
    },
    SetKind {
        node_id: NodeId,
        new_kind: Kind,
    },
}

#[derive(Debug, Clone)]
pub enum Event {
    NodeCreated {
        node: Node,
        index: usize,
    },
    NodeDeleted {

        nodes: Vec<Node>,

        old_parent: Option<NodeId>,

        old_index: usize,
    },
    NodeMoved {
        node_id: NodeId,
        old_parent: Option<NodeId>,
        old_index: usize,
        new_parent: Option<NodeId>,
        new_index: usize,
    },
    PropSet {
        node_id: NodeId,
        key: PropKey,
        new_value: Value,

        old_value: Option<Value>,
    },
    PropDeleted {
        node_id: NodeId,
        key: PropKey,
        old_value: Value,
    },
    PropsSet {
        node_id: NodeId,

        changes: Vec<(PropKey, Value, Option<Value>)>,
    },
    ViewOverrideSet {
        node_id: NodeId,
        new_view: Option<ViewDef>,
        old_view: Option<ViewDef>,
    },
    KindSet {
        node_id: NodeId,
        new_kind: Kind,
        old_kind: Kind,
    },
    Batch(Vec<Event>),
}

impl Event {

    pub fn inverse(&self) -> Vec<Command> {
        match self {
            Event::NodeCreated { node, .. } => vec![
                Command::DeleteNode { id: node.id, cascade: true }
            ],
            Event::NodeDeleted { nodes, old_parent: _, old_index } => {

                nodes.iter().rev().map(|n| Command::CreateNode {
                    id: n.id,
                    kind: n.kind.clone(),
                    parent_id: n.parent,
                    index: if n.id == nodes[0].id { *old_index } else { 0 },
                    props: n.props.clone(),
                }).collect()
            }
            Event::NodeMoved { node_id, old_parent, old_index, .. } => vec![
                Command::MoveNode {
                    node_id: *node_id,
                    new_parent_id: *old_parent,
                    new_index: *old_index,
                }
            ],
            Event::PropSet { node_id, key, old_value, .. } => {
                match old_value {
                    Some(v) => vec![Command::SetProp {
                        node_id: *node_id,
                        key: key.clone(),
                        value: v.clone(),
                    }],
                    None => vec![Command::DeleteProp {
                        node_id: *node_id,
                        key: key.clone(),
                    }],
                }
            }
            Event::PropDeleted { node_id, key, old_value } => vec![
                Command::SetProp {
                    node_id: *node_id,
                    key: key.clone(),
                    value: old_value.clone(),
                }
            ],
            Event::PropsSet { node_id, changes } => {
                changes.iter().map(|(key, _, old_value)| {
                    match old_value {
                        Some(v) => Command::SetProp {
                            node_id: *node_id,
                            key: key.clone(),
                            value: v.clone(),
                        },
                        None => Command::DeleteProp {
                            node_id: *node_id,
                            key: key.clone(),
                        },
                    }
                }).collect()
            }
            Event::ViewOverrideSet { node_id, old_view, .. } => vec![
                Command::SetViewOverride {
                    node_id: *node_id,
                    view: old_view.clone(),
                }
            ],
            Event::KindSet { node_id, old_kind, .. } => vec![
                Command::SetKind {
                    node_id: *node_id,
                    new_kind: old_kind.clone(),
                }
            ],
            Event::Batch(events) => {

                events.iter().rev().flat_map(|e| e.inverse()).collect()
            }
        }
    }
}

pub fn apply(
    graph: &mut Graph,
    registry: &KindRegistry,
    cmd: Command,
    now: DateTime<Utc>,
) -> Result<Event, CommandError> {
    match cmd {
        Command::CreateNode { id, kind, parent_id, index, props } => {

            if let Some(pid) = parent_id {
                if !graph.contains(pid) {
                    return Err(CommandError::Graph(GraphError::NotFound(pid)));
                }
            }

            let constraint_cmd = Command::CreateNode { id, kind: kind.clone(), parent_id, index, props: props.clone() };
            let errs = registry.check_command(graph, &constraint_cmd);
            if !errs.is_empty() {
                return Err(CommandError::Validation(errs));
            }

            let mut node = NodeBuilder::new(kind, now)
                .with_id(id)
                .with_props(props)
                .build();

            if let Some(pid) = parent_id {
                node.parent = Some(pid);
                graph.insert_child(node.clone(), pid, index)?;
            } else {
                graph.insert_root(node.clone())?;
            }

            Ok(Event::NodeCreated { node, index })
        }

        Command::DeleteNode { id, cascade: _ } => {

            if !graph.contains(id) {
                return Err(CommandError::Graph(GraphError::NotFound(id)));
            }

            let old_parent = graph.get(id).unwrap().parent;
            let old_index = find_child_index(graph, id, old_parent);

            let nodes = graph.remove_subtree(id)?;

            Ok(Event::NodeDeleted { nodes, old_parent, old_index })
        }

        Command::MoveNode { node_id, new_parent_id, new_index } => {

            if !graph.contains(node_id) {
                return Err(CommandError::Graph(GraphError::NotFound(node_id)));
            }
            if let Some(pid) = new_parent_id {
                if !graph.contains(pid) {
                    return Err(CommandError::Graph(GraphError::NotFound(pid)));
                }
                if node_id == pid || graph.is_ancestor_of(node_id, pid) {
                    return Err(CommandError::Graph(GraphError::CycleDetected(node_id, pid)));
                }
            }

            let errs = registry.check_command(graph, &Command::MoveNode { node_id, new_parent_id, new_index });
            if !errs.is_empty() {
                return Err(CommandError::Validation(errs));
            }

            let old_parent = graph.get(node_id).unwrap().parent;
            let old_index = find_child_index(graph, node_id, old_parent);

            graph.move_node(node_id, new_parent_id, new_index)?;

            Ok(Event::NodeMoved { node_id, old_parent, old_index, new_parent: new_parent_id, new_index })
        }

        Command::SetProp { node_id, key, value } => {

            if !graph.contains(node_id) {
                return Err(CommandError::Graph(GraphError::NotFound(node_id)));
            }

            let old_value = graph.set_prop(node_id, key.clone(), value.clone())?;

            graph.get_mut(node_id).unwrap().updated_at = now;

            Ok(Event::PropSet { node_id, key, new_value: value, old_value })
        }

        Command::DeleteProp { node_id, key } => {

            if !graph.contains(node_id) {
                return Err(CommandError::Graph(GraphError::NotFound(node_id)));
            }

            let old_value = graph.delete_prop(node_id, &key)?
                .ok_or_else(|| CommandError::NotFound(node_id))?;
            graph.get_mut(node_id).unwrap().updated_at = now;

            Ok(Event::PropDeleted { node_id, key, old_value })
        }

        Command::SetProps { node_id, props } => {

            if !graph.contains(node_id) {
                return Err(CommandError::Graph(GraphError::NotFound(node_id)));
            }

            let mut changes = Vec::new();
            for (key, value) in props {
                let old_value = graph.set_prop(node_id, key.clone(), value.clone())?;
                changes.push((key, value, old_value));
            }
            graph.get_mut(node_id).unwrap().updated_at = now;

            Ok(Event::PropsSet { node_id, changes })
        }

        Command::SetViewOverride { node_id, view } => {

            let node = graph.get_mut(node_id)
                .ok_or(CommandError::Graph(GraphError::NotFound(node_id)))?;

            let old_view = node.view_override.take();
            node.view_override = view.clone();
            node.updated_at = now;

            Ok(Event::ViewOverrideSet { node_id, new_view: view, old_view })
        }
        Command::SetKind { node_id, new_kind } => {

            let node = graph.get_mut(node_id)
                .ok_or(CommandError::Graph(GraphError::NotFound(node_id)))?;

            let old_kind = node.kind.clone();
            node.kind = new_kind.clone();
            node.updated_at = now;

            Ok(Event::KindSet { node_id, new_kind, old_kind })
        }
    }
}

fn find_child_index(graph: &Graph, node_id: NodeId, parent: Option<NodeId>) -> usize {
    match parent {
        Some(pid) => graph.get(pid)
            .and_then(|p| p.children.iter().position(|&c| c == node_id))
            .unwrap_or(0),
        None => graph.roots()
            .iter()
            .position(|&r| r == node_id)
            .unwrap_or(0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use crate::primitives::kinds;
    use crate::registry::CoreLibrary;

    fn fixed_now() -> DateTime<Utc> {
        Utc.with_ymd_and_hms(2024, 1, 1, 0, 0, 0).unwrap()
    }

    fn setup() -> (Graph, KindRegistry) {
        let mut registry = KindRegistry::new();
        CoreLibrary::init(&mut registry);
        (Graph::new(), registry)
    }

    #[test]
    fn create_root_node() {
        let (mut graph, registry) = setup();
        let id = NodeId::new();
        let cmd = Command::CreateNode {
            id,
            kind: kinds::page(),
            parent_id: None,
            index: 0,
            props: crate::props!("title" => Value::text("Hello")),
        };
        let event = apply(&mut graph, &registry, cmd, fixed_now()).unwrap();
        assert!(graph.contains(id));
        assert!(matches!(event, Event::NodeCreated { .. }));
    }

    #[test]
    fn create_child_node() {
        let (mut graph, registry) = setup();
        let parent_id = NodeId::new();
        apply(&mut graph, &registry, Command::CreateNode {
            id: parent_id, kind: kinds::page(), parent_id: None, index: 0,
            props: crate::props!("title" => Value::text("Parent")),
        }, fixed_now()).unwrap();

        let child_id = NodeId::new();
        apply(&mut graph, &registry, Command::CreateNode {
            id: child_id, kind: kinds::paragraph(), parent_id: Some(parent_id), index: 0,
            props: Props::new(),
        }, fixed_now()).unwrap();

        assert!(graph.get(parent_id).unwrap().children.contains(&child_id));
        assert_eq!(graph.get(child_id).unwrap().parent, Some(parent_id));
    }

    #[test]
    fn delete_node_with_cascade() {
        let (mut graph, registry) = setup();
        let parent_id = NodeId::new();
        let child_id = NodeId::new();

        apply(&mut graph, &registry, Command::CreateNode {
            id: parent_id, kind: kinds::page(), parent_id: None, index: 0,
            props: crate::props!("title" => Value::text("Parent")),
        }, fixed_now()).unwrap();

        apply(&mut graph, &registry, Command::CreateNode {
            id: child_id, kind: kinds::paragraph(), parent_id: Some(parent_id), index: 0,
            props: Props::new(),
        }, fixed_now()).unwrap();

        let event = apply(&mut graph, &registry, Command::DeleteNode { id: parent_id, cascade: true }, fixed_now()).unwrap();

        assert!(!graph.contains(parent_id));
        assert!(!graph.contains(child_id));

        let undo_cmds = event.inverse();
        assert!(!undo_cmds.is_empty());
    }

    #[test]
    fn set_prop_and_undo() {
        let (mut graph, registry) = setup();
        let id = NodeId::new();

        apply(&mut graph, &registry, Command::CreateNode {
            id, kind: kinds::page(), parent_id: None, index: 0,
            props: crate::props!("title" => Value::text("Original")),
        }, fixed_now()).unwrap();

        let event = apply(&mut graph, &registry, Command::SetProp {
            node_id: id,
            key: PropKey::from("title"),
            value: Value::text("Updated"),
        }, fixed_now()).unwrap();

        assert_eq!(graph.get(id).unwrap().prop_text("title"), Some("Updated"));

        for undo_cmd in event.inverse() {
            apply(&mut graph, &registry, undo_cmd, fixed_now()).unwrap();
        }
        assert_eq!(graph.get(id).unwrap().prop_text("title"), Some("Original"));
    }

    #[test]
    fn backlink_index_maintained() {
        let (mut graph, registry) = setup();
        let page_id = NodeId::new();
        let ref_id = NodeId::new();

        apply(&mut graph, &registry, Command::CreateNode {
            id: page_id, kind: kinds::page(), parent_id: None, index: 0,
            props: Props::new(),
        }, fixed_now()).unwrap();

        apply(&mut graph, &registry, Command::CreateNode {
            id: ref_id, kind: kinds::page(), parent_id: None, index: 1,
            props: crate::props!("target" => Value::Ref(page_id)),
        }, fixed_now()).unwrap();

        let backlinks: Vec<_> = graph.backlinks(page_id).collect();
        assert!(backlinks.contains(&ref_id));
    }
}

use std::collections::HashMap;

use crate::command::Command;
use crate::graph::Graph;
use crate::node::Node;
use crate::primitives::{Kind, PropKey, kinds, props};
use crate::schema::{Constraint, KindDef, PropDef, ValidationError, ValueType};
use crate::view::{CanvasLayout, CollectionLayout, DocumentLayout, Surface, ViewDef};

#[derive(Debug, Clone, Default)]
pub struct KindRegistry {
    kinds: HashMap<Kind, KindDef>,
}

impl KindRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn register(&mut self, kind: impl Into<Kind>, def: KindDef) {
        self.kinds.insert(kind.into(), def);
    }

    pub fn unregister(&mut self, kind: &Kind) {
        self.kinds.remove(kind);
    }

    pub fn iter(&self) -> impl Iterator<Item = (&Kind, &KindDef)> {
        self.kinds.iter()
    }

    pub fn get(&self, kind: &Kind) -> Option<&KindDef> {
        self.kinds.get(kind)
    }

    pub fn contains(&self, kind: &Kind) -> bool {
        self.kinds.contains_key(kind)
    }

    pub fn validate_node(&self, node: &Node) -> Vec<ValidationError> {
        let def = match self.kinds.get(&node.kind) {
            Some(d) => d,
            None => return Vec::new(),
        };

        let mut errors = Vec::new();
        for (key, prop_def) in &def.props {
            if prop_def.required && node.props.get(key).map(|v| v.is_null()).unwrap_or(true) {
                errors.push(ValidationError::MissingRequiredProp(key.clone()));
            }
        }
        errors
    }

    pub fn check_command(&self, graph: &Graph, cmd: &Command) -> Vec<ValidationError> {
        let mut errors = Vec::new();

        match cmd {
            Command::CreateNode {
                kind,
                parent_id: Some(pid),
                ..
            } => {
                if let Some(parent) = graph.get(*pid) {
                    if let Some(parent_def) = self.kinds.get(&parent.kind) {
                        for c in &parent_def.constraints {
                            if let Constraint::AllowedChildKinds(allowed) = c
                                && !allowed.contains(kind)
                            {
                                errors.push(ValidationError::ConstraintViolation(format!(
                                    "{} is not an allowed child of {}",
                                    kind, parent.kind
                                )));
                            }
                            if let Constraint::MaxChildren(max) = c
                                && graph.children_of(*pid).count() >= *max
                            {
                                errors.push(ValidationError::ConstraintViolation(format!(
                                    "{} has reached max children ({})",
                                    parent.kind, max
                                )));
                            }
                        }
                    }

                    if let Some(child_def) = self.kinds.get(kind) {
                        for c in &child_def.constraints {
                            if let Constraint::AllowedParentKinds(allowed) = c
                                && !allowed.contains(&parent.kind)
                            {
                                errors.push(ValidationError::ConstraintViolation(format!(
                                    "{} is not an allowed parent of {}",
                                    parent.kind, kind
                                )));
                            }
                        }
                    }
                }
            }
            Command::CreateNode { .. } => {}
            Command::MoveNode {
                node_id,
                new_parent_id,
                ..
            } => {
                if let (Some(node), Some(pid)) = (graph.get(*node_id), new_parent_id)
                    && let Some(parent) = graph.get(*pid)
                    && let Some(parent_def) = self.kinds.get(&parent.kind)
                {
                    for c in &parent_def.constraints {
                        if let Constraint::AllowedChildKinds(allowed) = c
                            && !allowed.contains(&node.kind)
                        {
                            errors.push(ValidationError::ConstraintViolation(format!(
                                "{} is not allowed as child of {}",
                                node.kind, parent.kind
                            )));
                        }
                    }
                }
            }
            _ => {}
        }

        errors
    }
}

pub struct CoreLibrary;

impl CoreLibrary {
    pub fn init(registry: &mut KindRegistry) {
        registry.register(
            kinds::page(),
            KindDef::new("Page", props::title())
                .with_icon("📄")
                .with_prop(
                    props::title(),
                    PropDef::new(ValueType::Text).with_label("Title"),
                )
                .with_view(ViewDef::new(Surface::Document {
                    layout: DocumentLayout::VerticalStream,
                })),
        );

        registry.register(
            kinds::paragraph(),
            KindDef::new("Paragraph", props::body())
                .with_prop(
                    props::body(),
                    PropDef::new(ValueType::Rich).with_label("Content"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "paragraph".into(),
                })),
        );

        registry.register(
            kinds::heading(),
            KindDef::new("Heading", props::body())
                .with_prop(
                    props::body(),
                    PropDef::new(ValueType::Rich).with_label("Text"),
                )
                .with_prop(
                    props::level(),
                    PropDef::new(ValueType::Int).optional().with_label("Level"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "heading".into(),
                })),
        );

        registry.register(
            kinds::task(),
            KindDef::new("Task", props::title())
                .with_icon("✓")
                .with_prop(
                    props::title(),
                    PropDef::new(ValueType::Text).with_label("Title"),
                )
                .with_prop(
                    props::checked(),
                    PropDef::new(ValueType::Bool).optional().with_label("Done"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "task".into(),
                })),
        );

        registry.register(
            kinds::image(),
            KindDef::new("Image", props::title())
                .with_icon("🖼")
                .with_prop(
                    props::url(),
                    PropDef::new(ValueType::Text).with_label("URL"),
                )
                .with_prop(
                    props::title(),
                    PropDef::new(ValueType::Text)
                        .optional()
                        .with_label("Caption"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "image".into(),
                })),
        );

        registry.register(
            kinds::audio(),
            KindDef::new("Audio", props::title())
                .with_icon("🎵")
                .with_prop(
                    props::url(),
                    PropDef::new(ValueType::Text).with_label("URL"),
                )
                .with_prop(
                    props::title(),
                    PropDef::new(ValueType::Text)
                        .optional()
                        .with_label("Title"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "audio".into(),
                })),
        );

        registry.register(
            kinds::binary(),
            KindDef::new("Binary", props::title())
                .with_icon("📎")
                .with_prop(
                    props::url(),
                    PropDef::new(ValueType::Text).with_label("URL"),
                )
                .with_prop(
                    props::title(),
                    PropDef::new(ValueType::Text)
                        .optional()
                        .with_label("Filename"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "file".into(),
                })),
        );

        registry.register(
            kinds::flashcard(),
            KindDef::new("Flashcard", props::front())
                .with_icon("🗂")
                .with_prop(
                    props::front(),
                    PropDef::new(ValueType::Rich).with_label("Front"),
                )
                .with_prop(
                    props::back(),
                    PropDef::new(ValueType::Rich).with_label("Back"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "flashcard".into(),
                })),
        );

        registry.register(
            kinds::canvas(),
            KindDef::new("Canvas", props::title())
                .with_icon("🎨")
                .with_prop(props::title(), PropDef::new(ValueType::Text).optional())
                .with_view(ViewDef::new(Surface::Canvas {
                    layout: CanvasLayout::Absolute,
                    diagram_kind: None,
                })),
        );

        registry.register(
            kinds::connection(),
            KindDef::new("Connection", props::from())
                .with_icon("→")
                .with_prop(
                    props::from(),
                    PropDef::new(ValueType::Ref).with_label("From"),
                )
                .with_prop(props::to(), PropDef::new(ValueType::Ref).with_label("To"))
                .with_prop(
                    PropKey::from("routing"),
                    PropDef::new(ValueType::Text)
                        .optional()
                        .with_label("Routing"),
                )
                .with_view(ViewDef::new(Surface::Widget {
                    name: "connection".into(),
                })),
        );

        registry.register(
            kinds::inbox(),
            KindDef::new("Inbox", props::title())
                .with_icon("📥")
                .with_prop(props::title(), PropDef::new(ValueType::Text).optional())
                .with_view(ViewDef::new(Surface::Collection {
                    layout: CollectionLayout::List,
                })),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn core_library_registers_all_kinds() {
        let mut registry = KindRegistry::new();
        CoreLibrary::init(&mut registry);

        assert!(registry.contains(&kinds::page()));
        assert!(registry.contains(&kinds::paragraph()));
        assert!(registry.contains(&kinds::heading()));
        assert!(registry.contains(&kinds::task()));
        assert!(registry.contains(&kinds::image()));
        assert!(registry.contains(&kinds::audio()));
        assert!(registry.contains(&kinds::binary()));
        assert!(registry.contains(&kinds::flashcard()));
        assert!(registry.contains(&kinds::canvas()));
        assert!(registry.contains(&kinds::connection()));
        assert!(registry.contains(&kinds::inbox()));
    }
}

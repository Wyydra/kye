use std::collections::BTreeMap;
use crate::models::block::schema::{FieldName, FieldType, TypeDefinition, TypeName};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // Text
        registry.register(
            TypeName::new("text"),
            TypeDefinition::empty(),
        );

        // Link (A connection between two blocks)
        let mut link_fields = BTreeMap::new();
        link_fields.insert(FieldName::new("from"), FieldType::String); // Link source ID
        link_fields.insert(FieldName::new("to"), FieldType::String);   // Link target ID
        registry.register(
            TypeName::new("link"),
            TypeDefinition::new(link_fields),
        );

        // Image
        let mut image_fields = BTreeMap::new();
        image_fields.insert(FieldName::new("url"), FieldType::String);
        registry.register(
            TypeName::new("image"),
            TypeDefinition::new(image_fields),
        );

        // Port
        let mut port_fields = BTreeMap::new();
        port_fields.insert(FieldName::new("id"), FieldType::String); // Should ideally be UUID
        port_fields.insert(FieldName::new("parent"), FieldType::String); // Should ideally be UUID
        registry.register(
            TypeName::new("port"),
            TypeDefinition::new(port_fields),
        );
    }
}

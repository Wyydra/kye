use std::collections::BTreeMap;
use crate::models::block::type_def::{FieldName, FieldType, TypeDefinition, TypeName};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // Text
        registry.register(
            TypeName::new("text"),
            TypeDefinition::empty(),
        );

        // Image
        let mut image_fields = BTreeMap::new();
        image_fields.insert(FieldName::new("url"), FieldType::String);
        image_fields.insert(FieldName::new("alt"), FieldType::String);
        image_fields.insert(FieldName::new("width"), FieldType::Integer);
        image_fields.insert(FieldName::new("height"), FieldType::Integer);
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

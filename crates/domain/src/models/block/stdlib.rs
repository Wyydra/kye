use std::collections::BTreeMap;
use crate::models::block::schema::{
    FieldName, FieldType, TypeDefinition, TypeName
};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // Text
        registry.register(
            TypeName::new("text"),
            TypeDefinition::empty(),
        );

        // Connection (An arrow between two blocks)
        let mut conn_fields = BTreeMap::new();
        conn_fields.insert(FieldName::new("from"), FieldType::BlockId);
        conn_fields.insert(FieldName::new("to"), FieldType::BlockId);
        registry.register(
            TypeName::new("connection"),
            TypeDefinition::new(conn_fields, None),
        );

        // Image
        let mut image_fields = BTreeMap::new();
        image_fields.insert(FieldName::new("url"), FieldType::Url);
        registry.register(
            TypeName::new("image"),
            TypeDefinition::new(image_fields, None),
        );
    }
}

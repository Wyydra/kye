use std::collections::BTreeMap;
use crate::models::block::schema::{
    FieldName, FieldType, TypeDefinition, TypeName, View, ViewKind
};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // Text
        registry.register(
            TypeName::new("text"),
            TypeDefinition::new(
                BTreeMap::new(),
                Some(View::new(ViewKind::Component("markdown".to_string())))
            ),
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
        
        let mut image_layout = View::new(ViewKind::Component("image".to_string()));
        image_layout.bindings.insert("value".to_string(), FieldName::new("url"));
        
        registry.register(
            TypeName::new("image"),
            TypeDefinition::new(image_fields, Some(image_layout)),
        );
    }
}

use std::collections::BTreeMap;
use crate::models::block::schema::{
    FieldName, FieldType, TypeDefinition, TypeName, View, ViewKind, LayoutDirection
};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // Text
        let mut text_fields = BTreeMap::new();
        text_fields.insert(FieldName::new("title"), FieldType::String);
        text_fields.insert(FieldName::new("body"), FieldType::Markdown);
        
        let mut text_layout = View::new(ViewKind::Component("markdown".to_string()));
        text_layout.bindings.insert("value".to_string(), FieldName::new("body"));

        registry.register(
            TypeName::new("text"),
            TypeDefinition::new(text_fields, Some(text_layout)),
        );

        // Connection (An arrow between two blocks)
        let mut conn_fields = BTreeMap::new();
        conn_fields.insert(FieldName::new("title"), FieldType::String);
        conn_fields.insert(FieldName::new("label"), FieldType::String);
        conn_fields.insert(FieldName::new("from"), FieldType::BlockId);
        conn_fields.insert(FieldName::new("to"), FieldType::BlockId);

        registry.register(
            TypeName::new("connection"),
            TypeDefinition::new(conn_fields, None),
        );

        // Image
        let mut image_fields = BTreeMap::new();
        image_fields.insert(FieldName::new("title"), FieldType::String);
        image_fields.insert(FieldName::new("src"), FieldType::Image);
        
        let mut image_layout = View::new(ViewKind::Component("image".to_string()));
        image_layout.bindings.insert("value".to_string(), FieldName::new("src"));
        
        registry.register(
            TypeName::new("image"),
            TypeDefinition::new(image_fields, Some(image_layout)),
        );

        // Link
        let mut link_fields = BTreeMap::new();
        link_fields.insert(FieldName::new("title"), FieldType::String);
        link_fields.insert(FieldName::new("url"), FieldType::Link);
        link_fields.insert(FieldName::new("label"), FieldType::String);
        
        let mut link_layout = View::new(ViewKind::Component("link".to_string()));
        link_layout.bindings.insert("value".to_string(), FieldName::new("url"));
        link_layout.bindings.insert("label".to_string(), FieldName::new("label"));
        
        registry.register(
            TypeName::new("link"),
            TypeDefinition::new(link_fields, Some(link_layout)),
        );

        // Image with Text (Composite Type)
        let mut iwt_fields = BTreeMap::new();
        iwt_fields.insert(FieldName::new("src"), FieldType::Image);
        iwt_fields.insert(FieldName::new("caption"), FieldType::Markdown);

        let mut iwt_layout = View::new(ViewKind::Stack(LayoutDirection::Vertical));

        let mut img_part = View::new(ViewKind::Component("image".to_string()));
        img_part.bindings.insert("value".to_string(), FieldName::new("src"));

        let mut txt_part = View::new(ViewKind::Component("markdown".to_string()));
        txt_part.bindings.insert("value".to_string(), FieldName::new("caption"));

        iwt_layout.children = vec![img_part, txt_part];

        registry.register(
            TypeName::new("image_with_text"),
            TypeDefinition::new(iwt_fields, Some(iwt_layout)),
        );

        // Flashcard (Structured Knowledge)
        let mut fc_fields = BTreeMap::new();
        fc_fields.insert(FieldName::new("title"), FieldType::String);
        fc_fields.insert(FieldName::new("front"), FieldType::Markdown);
        fc_fields.insert(FieldName::new("back"), FieldType::Markdown);

        let mut fc_layout = View::new(ViewKind::Component("flashcard".to_string()));
        fc_layout.bindings.insert("front".to_string(), FieldName::new("front"));
        fc_layout.bindings.insert("back".to_string(), FieldName::new("back"));

        registry.register(
            TypeName::new("flashcard"),
            TypeDefinition::new(fc_fields, Some(fc_layout)),
        );
    }
}

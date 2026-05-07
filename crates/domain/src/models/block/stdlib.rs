use std::collections::BTreeMap;
use crate::models::block::schema::{
    FieldName, FieldType, TypeDefinition, TypeName, View, ViewKind, LayoutDirection, FieldSchema
};
use crate::models::block::type_registry::TypeRegistry;

pub struct StandardLibrary;

impl StandardLibrary {
    pub fn init(registry: &mut TypeRegistry) {
        // --- Text ---
        let mut text_fields = BTreeMap::new();
        text_fields.insert(FieldName::new("title"), FieldSchema::new(FieldType::String).with_label("Title"));
        text_fields.insert(FieldName::new("body"), FieldSchema::new(FieldType::Markdown).with_label("Content"));
        
        let mut text_layout = View::new(ViewKind::Component("markdown".to_string()));
        text_layout.bindings.insert("value".to_string(), FieldName::new("body"));

        registry.register(
            TypeName::new("text"),
            TypeDefinition::new(text_fields, Some(text_layout)),
        );

        // --- Connection ---
        let mut conn_fields = BTreeMap::new();
        conn_fields.insert(FieldName::new("title"), FieldSchema::new(FieldType::String).with_label("Label").optional());
        conn_fields.insert(FieldName::new("from"), FieldSchema::new(FieldType::BlockId));
        conn_fields.insert(FieldName::new("to"), FieldSchema::new(FieldType::BlockId));

        registry.register(
            TypeName::new("connection"),
            TypeDefinition {
                fields: conn_fields,
                layout: None,
            },
        );

        // --- Image ---
        let mut image_fields = BTreeMap::new();
        image_fields.insert(FieldName::new("title"), FieldSchema::new(FieldType::String).with_label("Title").optional());
        image_fields.insert(FieldName::new("src"), FieldSchema::new(FieldType::Image).with_label("Source URL"));
        
        let mut image_layout = View::new(ViewKind::Component("image".to_string()));
        image_layout.bindings.insert("value".to_string(), FieldName::new("src"));
        
        registry.register(
            TypeName::new("image"),
            TypeDefinition::new(image_fields, Some(image_layout)),
        );

        // --- Link ---
        let mut link_fields = BTreeMap::new();
        link_fields.insert(FieldName::new("title"), FieldSchema::new(FieldType::String).optional());
        link_fields.insert(FieldName::new("url"), FieldSchema::new(FieldType::Link).with_label("URL"));
        link_fields.insert(FieldName::new("label"), FieldSchema::new(FieldType::String).with_label("Display Text").optional());
        
        let mut link_layout = View::new(ViewKind::Component("link".to_string()));
        link_layout.bindings.insert("value".to_string(), FieldName::new("url"));
        link_layout.bindings.insert("label".to_string(), FieldName::new("label"));
        
        registry.register(
            TypeName::new("link"),
            TypeDefinition::new(link_fields, Some(link_layout)),
        );

        // --- Image with Text (Pure Duck Typing Example) ---
        let mut iwt_fields = BTreeMap::new();
        iwt_fields.insert(FieldName::new("src"), FieldSchema::new(FieldType::Image));
        iwt_fields.insert(FieldName::new("caption"), FieldSchema::new(FieldType::Markdown).with_label("Caption"));

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

        // --- Flashcard ---
        let mut fc_fields = BTreeMap::new();
        fc_fields.insert(FieldName::new("title"), FieldSchema::new(FieldType::String).optional());
        fc_fields.insert(FieldName::new("front"), FieldSchema::new(FieldType::Markdown).with_label("Front Side"));
        fc_fields.insert(FieldName::new("back"), FieldSchema::new(FieldType::Markdown).with_label("Back Side"));

        let mut fc_layout = View::new(ViewKind::Component("flashcard".to_string()));
        fc_layout.bindings.insert("front".to_string(), FieldName::new("front"));
        fc_layout.bindings.insert("back".to_string(), FieldName::new("back"));

        registry.register(
            TypeName::new("flashcard"),
            TypeDefinition::new(fc_fields, Some(fc_layout)),
        );
    }
}

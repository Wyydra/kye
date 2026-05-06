use std::collections::BTreeMap;
use crate::models::block::schema::{TypeName, TypeDefinition};

#[derive(Clone, Debug, Default)]
pub struct TypeRegistry {
    types: BTreeMap<TypeName, TypeDefinition>,
}

impl TypeRegistry {
    pub fn new() -> Self {
        Self {
            types: BTreeMap::new(),
        }
    }

    pub fn register(&mut self, name: TypeName, definition: TypeDefinition) {
        self.types.insert(name, definition);
    }

    pub fn get(&self, name: &TypeName) -> Option<&TypeDefinition> {
        self.types.get(name)
    }

    pub fn types(&self) -> &BTreeMap<TypeName, TypeDefinition> {
        &self.types
    }

    pub fn identify_block_shapes(&self, fields: &crate::models::block::schema::Fields) -> Vec<TypeName> {
        let mut shapes = Vec::new();
        for (name, definition) in &self.types {
            if definition.matches(fields, self) {
                shapes.push(name.clone());
            }
        }
        shapes
    }


}

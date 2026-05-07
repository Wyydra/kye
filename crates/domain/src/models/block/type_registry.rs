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

    pub fn unregister(&mut self, name: &TypeName) {
        self.types.remove(name);
    }

    pub fn get(&self, name: &TypeName) -> Option<&TypeDefinition> {
        self.types.get(name)
    }

    pub fn types(&self) -> &BTreeMap<TypeName, TypeDefinition> {
        &self.types
    }

    pub fn identify_block_shapes(&self, fields: &crate::models::block::schema::Fields) -> Vec<TypeName> {
        let mut candidates: Vec<(TypeName, &TypeDefinition, usize)> = Vec::new();
        
        for (name, definition) in &self.types {
            if definition.matches(fields, self) {
                // Coverage is how many fields from the input are used by this type
                let coverage = definition.fields.len();
                candidates.push((name.clone(), definition, coverage));
            }
        }
        
        // Sort by specificity
        candidates.sort_by(|(name_a, def_a, cov_a), (name_b, def_b, cov_b)| {
            // 1. Structural Subsumption (The core of structural typing)
            if def_a.is_more_specific_than(def_b, self) {
                return std::cmp::Ordering::Less;
            }
            if def_b.is_more_specific_than(def_a, self) {
                return std::cmp::Ordering::Greater;
            }
            
            // 2. Coverage (Field Density) - More fields mean more specific intent
            if cov_a != cov_b {
                return cov_b.cmp(cov_a); // More fields first
            }
            
            // 4. Stability (Alphabetical)
            name_a.to_string().cmp(&name_b.to_string())
        });
        
        candidates.into_iter().map(|(name, _, _)| name).collect()
    }


}

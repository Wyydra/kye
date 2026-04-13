use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use domain::models::block::metadata::{Metadata, Fields, Value};
use domain::models::block::schema::FieldName;
use domain::ports::MetadataProvider;
use uuid::Uuid;

#[derive(Deserialize, Serialize, Debug)]
#[serde(untagged)]
enum JsonValue {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    String(String),
    Array(Vec<JsonValue>),
    Object(BTreeMap<String, JsonValue>),
}

impl JsonValue {
    fn as_str(&self) -> Option<&str> {
        match self {
            JsonValue::String(s) => Some(s),
            _ => None,
        }
    }
}

use std::str::FromStr;

pub struct JsonMetadataProvider(pub String);

impl JsonMetadataProvider {
    pub fn get_id(&self) -> Option<Uuid> {
        let result: Result<BTreeMap<String, JsonValue>, _> = serde_json::from_str(&self.0);
        result.ok()?.get("id")?.as_str().and_then(|s| Uuid::from_str(s).ok())
    }
}

impl MetadataProvider for JsonMetadataProvider {
    fn get_id(&self) -> Option<Uuid> {
        self.get_id()
    }

    fn get_fields(&self) -> Result<Fields, String> {
        if self.0.trim().is_empty() {
            return Ok(Fields::new());
        }

        let result: Result<BTreeMap<String, JsonValue>, serde_json::Error> = serde_json::from_str(&self.0);
        
        match result {
            Ok(obj) => {
                let mut fields = Fields::new();
                for (k, v) in obj {
                    if k != "id" {
                        fields.insert(FieldName::new(&k), map_to_domain(v));
                    }
                }
                Ok(fields)
            }
            Err(e) => Err(e.to_string()),
        }
    }
}

pub fn render_json(id: &Uuid, metadata: &Metadata) -> String {
    let fields = metadata.fields();
    let mut map = BTreeMap::new();
    map.insert("id".to_string(), JsonValue::String(id.to_string()));
    for (name, value) in fields.iter() {
        map.insert(name.to_string(), map_to_json(value));
    }
    
    serde_json::to_string(&map).unwrap_or_default()
}

fn map_to_domain(json_val: JsonValue) -> Value {
    match json_val {
        JsonValue::Null => Value::None,
        JsonValue::Bool(b) => Value::Boolean(b),
        JsonValue::Int(i) => Value::Integer(i),
        JsonValue::Float(f) => Value::Float(f),
        JsonValue::String(s) => Value::String(s),
        JsonValue::Array(arr) => {
            Value::Array(arr.into_iter().map(map_to_domain).collect())
        }
        JsonValue::Object(obj) => {
            let mut fields = Fields::new();
            for (k, v) in obj {
                fields.insert(FieldName::new(&k), map_to_domain(v));
            }
            Value::Object(fields)
        }
    }
}

fn map_to_json(value: &Value) -> JsonValue {
    match value {
        Value::None => JsonValue::Null,
        Value::Boolean(b) => JsonValue::Bool(*b),
        Value::Integer(i) => JsonValue::Int(*i),
        Value::Float(f) => JsonValue::Float(*f),
        Value::String(s) => JsonValue::String(s.clone()),
        Value::Array(arr) => {
            JsonValue::Array(arr.iter().map(map_to_json).collect())
        }
        Value::Object(fields) => {
            let mut map = BTreeMap::new();
            for (name, val) in fields.iter() {
                map.insert(name.to_string(), map_to_json(val));
            }
            JsonValue::Object(map)
        }
    }
}

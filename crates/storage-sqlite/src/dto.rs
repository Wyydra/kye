use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use domain::graph::Graph;
use domain::node::{Node, NodeBuilder};
use domain::ports::RepositoryError;
use domain::primitives::{Kind, NodeId, PropKey};
use domain::schema::KindDef;
use domain::value::{Props, Value};
use domain::view::ViewDef;
use domain::workspace::WorkspaceMeta;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetaRow {
    pub id: String,
    pub name: String,
    pub default_remote: Option<String>,
    pub remotes_json: String,
}

impl MetaRow {
    pub fn to_domain(&self) -> Result<WorkspaceMeta, RepositoryError> {
        let uuid = uuid::Uuid::parse_str(&self.id)
            .map_err(|e| RepositoryError::Corrupted(format!("Invalid workspace UUID: {}", e)))?;
        let default_remote = self
            .default_remote
            .as_ref()
            .and_then(|r| domain::model::remote::RemoteName::new(r.clone()).ok());

        let raw_remotes: HashMap<String, String> =
            serde_json::from_str(&self.remotes_json).unwrap_or_default();
        let mut remotes = HashMap::new();
        for (k, v) in raw_remotes {
            if let (Ok(r_name), Ok(r_url)) = (
                domain::model::remote::RemoteName::new(k),
                domain::model::remote::RemoteUrl::new(v),
            ) {
                remotes.insert(r_name, r_url);
            }
        }

        Ok(WorkspaceMeta::with_remotes(
            uuid,
            self.name.clone(),
            default_remote,
            remotes,
        ))
    }

    pub fn from_domain(meta: &WorkspaceMeta) -> Self {
        let remotes_raw: HashMap<String, String> = meta
            .remotes
            .iter()
            .map(|(k, v)| (k.as_str().to_string(), v.as_str().to_string()))
            .collect();
        let remotes_json = serde_json::to_string(&remotes_raw).unwrap_or_default();

        Self {
            id: meta.id.to_string(),
            name: meta.name.clone(),
            default_remote: meta.default_remote.as_ref().map(|r| r.as_str().to_string()),
            remotes_json,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockRow {
    pub id: String,
    pub parent_id: Option<String>,
    pub kind: String,
    pub properties: String,
    pub content_ids: String,
    pub created_at: String,
    pub updated_at: String,
    pub view_override_json: Option<String>,
}

impl BlockRow {
    pub fn from_domain(node: &Node, graph: &Graph) -> Self {
        let parent_id = graph.parent_of(node.id).map(|id| id.to_string());
        let children: Vec<String> = graph
            .children_of(node.id)
            .map(|c| c.id.to_string())
            .collect();
        let content_ids = serde_json::to_string(&children).unwrap_or_else(|_| "[]".into());

        let mut props_map: HashMap<String, ValueJson> = HashMap::new();
        for (k, v) in &node.props {
            props_map.insert(k.as_str().to_string(), ValueJson::from(v));
        }
        let properties = serde_json::to_string(&props_map).unwrap_or_else(|_| "{}".into());

        let view_override_json = node
            .view_override
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());

        Self {
            id: node.id.to_string(),
            parent_id,
            kind: node.kind.as_str().to_string(),
            properties,
            content_ids,
            created_at: node.created_at.to_rfc3339(),
            updated_at: node.updated_at.to_rfc3339(),
            view_override_json,
        }
    }

    pub fn to_domain(&self) -> Result<Node, RepositoryError> {
        let uuid = uuid::Uuid::parse_str(&self.id)
            .map_err(|e| RepositoryError::Corrupted(format!("Invalid node UUID: {}", e)))?;
        let node_id = NodeId::from_uuid(uuid);

        let created_at = DateTime::parse_from_rfc3339(&self.created_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());
        let updated_at = DateTime::parse_from_rfc3339(&self.updated_at)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        let mut props = Props::new();
        if let Ok(raw_map) = serde_json::from_str::<HashMap<String, ValueJson>>(&self.properties) {
            for (k, v) in raw_map {
                props.insert(PropKey::from(k.as_str()), Value::from(v));
            }
        }

        let mut node = NodeBuilder::new(&self.kind, created_at)
            .with_id(node_id)
            .with_props(props)
            .build();
        node.updated_at = updated_at;

        if let Some(vo_str) = &self.view_override_json
            && let Ok(vo) = serde_json::from_str::<ViewDef>(vo_str)
        {
            node.view_override = Some(vo);
        }

        Ok(node)
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum ValueJson {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Ref(String),
    Array(Vec<ValueJson>),
    Date(String),
    DateTime(String),
    Color(String),
}

impl From<&Value> for ValueJson {
    fn from(v: &Value) -> Self {
        match v {
            Value::Null => ValueJson::Null,
            Value::Bool(b) => ValueJson::Bool(*b),
            Value::Int(i) => ValueJson::Int(*i),
            Value::Float(f) => ValueJson::Float(f.0),
            Value::Text(s) => ValueJson::Text(s.as_ref().to_string()),
            Value::Rich(rt) => ValueJson::Text(rt.to_plain_text()),
            Value::Ref(id) => ValueJson::Ref(id.to_string()),
            Value::Array(arr) => ValueJson::Array(arr.iter().map(ValueJson::from).collect()),
            Value::Date(d) => ValueJson::Date(d.to_string()),
            Value::DateTime(dt) => ValueJson::DateTime(dt.to_rfc3339()),
            Value::Color(c) => ValueJson::Color(c.as_str().to_string()),
        }
    }
}

impl From<ValueJson> for Value {
    fn from(v: ValueJson) -> Self {
        match v {
            ValueJson::Null => Value::Null,
            ValueJson::Bool(b) => Value::Bool(b),
            ValueJson::Int(i) => Value::Int(i),
            ValueJson::Float(f) => Value::Float(domain::value::FloatBits(f)),
            ValueJson::Text(s) => Value::Text(s.into()),
            ValueJson::Ref(id) => Value::Ref(NodeId::from_uuid(
                uuid::Uuid::parse_str(&id).unwrap_or_default(),
            )),
            ValueJson::Array(arr) => Value::Array(arr.into_iter().map(Value::from).collect()),
            ValueJson::Date(d) => Value::Date(d.parse().unwrap_or_default()),
            ValueJson::DateTime(dt) => Value::DateTime(
                chrono::DateTime::parse_from_rfc3339(&dt)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_default(),
            ),
            ValueJson::Color(c) => Value::Color(domain::value::Color::new(&c)),
        }
    }
}

#[derive(Debug, Clone)]
pub struct KindRow {
    pub kind: String,
    pub label: String,
    pub icon: Option<String>,
    pub title_prop: String,
    pub definition_json: String,
}

impl KindRow {
    pub fn to_domain(&self) -> (Kind, KindDef) {
        let kind = Kind::from(self.kind.as_str());
        if let Ok(mut def) = serde_json::from_str::<KindDef>(&self.definition_json) {
            def.label = self.label.clone();
            def.icon = self.icon.clone();
            def.title_prop = domain::primitives::PropKey::from(self.title_prop.as_str());
            return (kind, def);
        }
        let def = KindDef::new(&self.label, self.title_prop.as_str())
            .with_icon(self.icon.as_deref().unwrap_or(""));
        (kind, def)
    }

    pub fn from_domain(kind: &Kind, def: &KindDef) -> Self {
        let definition_json = serde_json::to_string(def).unwrap_or_else(|_| "{}".into());
        Self {
            kind: kind.as_str().to_string(),
            label: def.label.clone(),
            icon: def.icon.clone(),
            title_prop: def.title_prop.as_str().to_string(),
            definition_json,
        }
    }
}

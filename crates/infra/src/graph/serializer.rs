//! Sérialisation/désérialisation JSON des Nodes et WorkspaceMeta.

use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use domain::command::Event;
use domain::graph::Graph;
use domain::node::Node;
use domain::ports::RepositoryError;
use domain::primitives::{NodeId, PropKey};
use domain::value::{Color, FloatBits, Mark, Props, RichText, Span, Value};
use domain::view::{Direction, Layout, ViewDef};
use domain::workspace::WorkspaceMeta;

use crate::fs::WorkspaceFs;

// ── WorkspaceMeta ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct MetaJson {
    id: Uuid,
    name: String,
}

pub fn load_meta(fs: &WorkspaceFs) -> Result<WorkspaceMeta, RepositoryError> {
    let path = fs.meta_path();
    if !path.exists() {
        return Err(RepositoryError::NotFound("meta.json".into()));
    }
    let content = fs.read_file(&path)?;
    let m: MetaJson = serde_json::from_str(&content)
        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
    Ok(WorkspaceMeta::new(m.id, m.name))
}

pub fn save_meta(fs: &WorkspaceFs, meta: &WorkspaceMeta) -> Result<(), RepositoryError> {
    let m = MetaJson { id: meta.id, name: meta.name.clone() };
    let content = serde_json::to_string_pretty(&m)
        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
    fs.write_file(&fs.meta_path(), &content)
}

// ── Node JSON DTO ─────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct NodeJson {
    id: Uuid,
    kind: String,
    parent: Option<Uuid>,
    children: Vec<Uuid>,
    props: HashMap<String, ValueJson>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view_override: Option<ViewDefJson>,
}

fn node_to_json(node: &Node) -> NodeJson {
    NodeJson {
        id: node.id.as_uuid(),
        kind: node.kind.as_str().to_string(),
        parent: node.parent.map(|id| id.as_uuid()),
        children: node.children.iter().map(|id| id.as_uuid()).collect(),
        props: node.props.iter()
            .map(|(k, v)| (k.as_str().to_string(), value_to_json(v)))
            .collect(),
        created_at: node.created_at,
        updated_at: node.updated_at,
        view_override: node.view_override.as_ref().map(view_to_json),
    }
}

fn json_to_node(j: NodeJson) -> Node {
    use domain::node::NodeBuilder;
    let id = NodeId::from_uuid(j.id);
    let mut props = Props::new();
    for (k, v) in j.props {
        props.insert(PropKey::from(k.as_str()), json_to_value(v));
    }
    let mut node = NodeBuilder::new(j.kind.as_str(), j.created_at)
        .with_id(id)
        .with_props(props)
        .build();
    node.parent = j.parent.map(NodeId::from_uuid);
    node.children = j.children.into_iter().map(NodeId::from_uuid).collect();
    node.updated_at = j.updated_at;
    node.view_override = j.view_override.map(json_to_view);
    node
}

// ── Value JSON ─────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
#[serde(tag = "t", content = "v")]
enum ValueJson {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Rich(RichTextJson),
    Ref(Uuid),
    Array(Vec<ValueJson>),
    Date(String),       // ISO 8601
    DateTime(String),   // RFC 3339
    Color(String),
}

#[derive(Serialize, Deserialize)]
struct RichTextJson {
    spans: Vec<SpanJson>,
}

#[derive(Serialize, Deserialize)]
struct SpanJson {
    text: String,
    marks: Vec<MarkJson>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "t", content = "v")]
enum MarkJson {
    Bold,
    Italic,
    Code,
    Strikethrough,
    Underline,
    Link(String),
    Color(String),
    Ref(Uuid),
}

fn value_to_json(v: &Value) -> ValueJson {
    match v {
        Value::Null => ValueJson::Null,
        Value::Bool(b) => ValueJson::Bool(*b),
        Value::Int(i) => ValueJson::Int(*i),
        Value::Float(f) => ValueJson::Float(f.0),
        Value::Text(s) => ValueJson::Text(s.as_ref().to_string()),
        Value::Rich(rt) => ValueJson::Rich(RichTextJson {
            spans: rt.0.iter().map(|s| SpanJson {
                text: s.text.as_ref().to_string(),
                marks: s.marks.iter().map(mark_to_json).collect(),
            }).collect(),
        }),
        Value::Ref(id) => ValueJson::Ref(id.as_uuid()),
        Value::Array(arr) => ValueJson::Array(arr.iter().map(value_to_json).collect()),
        Value::Date(d) => ValueJson::Date(d.to_string()),
        Value::DateTime(dt) => ValueJson::DateTime(dt.to_rfc3339()),
        Value::Color(c) => ValueJson::Color(c.as_str().to_string()),
    }
}

fn json_to_value(j: ValueJson) -> Value {
    match j {
        ValueJson::Null => Value::Null,
        ValueJson::Bool(b) => Value::Bool(b),
        ValueJson::Int(i) => Value::Int(i),
        ValueJson::Float(f) => Value::Float(FloatBits(f)),
        ValueJson::Text(s) => Value::Text(Arc::from(s.as_str())),
        ValueJson::Rich(rt) => Value::Rich(RichText(rt.spans.into_iter().map(|s| {
            Span {
                text: Arc::from(s.text.as_str()),
                marks: s.marks.into_iter().map(json_to_mark).collect(),
            }
        }).collect())),
        ValueJson::Ref(id) => Value::Ref(NodeId::from_uuid(id)),
        ValueJson::Array(arr) => Value::Array(arr.into_iter().map(json_to_value).collect()),
        ValueJson::Date(s) => Value::Date(s.parse().unwrap_or_default()),
        ValueJson::DateTime(s) => Value::DateTime(
            DateTime::parse_from_rfc3339(&s).map(|dt| dt.with_timezone(&Utc)).unwrap_or_default()
        ),
        ValueJson::Color(s) => Value::Color(Color::new(&s)),
    }
}

fn mark_to_json(m: &Mark) -> MarkJson {
    match m {
        Mark::Bold => MarkJson::Bold,
        Mark::Italic => MarkJson::Italic,
        Mark::Code => MarkJson::Code,
        Mark::Strikethrough => MarkJson::Strikethrough,
        Mark::Underline => MarkJson::Underline,
        Mark::Link(url) => MarkJson::Link(url.as_ref().to_string()),
        Mark::Color(c) => MarkJson::Color(c.as_str().to_string()),
        Mark::Ref(id) => MarkJson::Ref(id.as_uuid()),
    }
}

fn json_to_mark(j: MarkJson) -> Mark {
    match j {
        MarkJson::Bold => Mark::Bold,
        MarkJson::Italic => Mark::Italic,
        MarkJson::Code => Mark::Code,
        MarkJson::Strikethrough => Mark::Strikethrough,
        MarkJson::Underline => Mark::Underline,
        MarkJson::Link(url) => Mark::Link(Arc::from(url.as_str())),
        MarkJson::Color(c) => Mark::Color(Color::new(&c)),
        MarkJson::Ref(id) => Mark::Ref(NodeId::from_uuid(id)),
    }
}

// ── ViewDef JSON ──────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize)]
struct ViewDefJson {
    layout: LayoutJson,
    bindings: HashMap<String, String>,
    actions: Vec<ActionDefJson>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "t", content = "v")]
enum LayoutJson {
    Document,
    Canvas,
    Grid { columns: u32 },
    Stack { direction: String },
    Gallery,
    Table,
    Kanban { group_by: String },
    Widget { name: String },
}

#[derive(Serialize, Deserialize)]
struct ActionDefJson {
    id: String,
    label: String,
    kind: String,
}

fn view_to_json(v: &ViewDef) -> ViewDefJson {
    ViewDefJson {
        layout: layout_to_json(&v.layout),
        bindings: v.bindings.iter().map(|(k, v)| (k.clone(), v.as_str().to_string())).collect(),
        actions: v.actions.iter().map(|a| ActionDefJson {
            id: a.id.clone(),
            label: a.label.clone(),
            kind: "custom".to_string(),
        }).collect(),
    }
}

fn json_to_view(j: ViewDefJson) -> ViewDef {
    let mut view = ViewDef::new(json_to_layout(j.layout));
    for (k, v) in j.bindings {
        view.bindings.insert(k, PropKey::from(v.as_str()));
    }
    view
}

fn layout_to_json(l: &Layout) -> LayoutJson {
    match l {
        Layout::Document => LayoutJson::Document,
        Layout::Canvas => LayoutJson::Canvas,
        Layout::Grid { columns } => LayoutJson::Grid { columns: *columns },
        Layout::Stack { direction } => LayoutJson::Stack {
            direction: match direction {
                Direction::Vertical => "vertical".to_string(),
                Direction::Horizontal => "horizontal".to_string(),
            }
        },
        Layout::Gallery => LayoutJson::Gallery,
        Layout::Table => LayoutJson::Table,
        Layout::Kanban { group_by } => LayoutJson::Kanban { group_by: group_by.as_str().to_string() },
        Layout::Widget { name } => LayoutJson::Widget { name: name.clone() },
    }
}

fn json_to_layout(j: LayoutJson) -> Layout {
    match j {
        LayoutJson::Document => Layout::Document,
        LayoutJson::Canvas => Layout::Canvas,
        LayoutJson::Grid { columns } => Layout::Grid { columns },
        LayoutJson::Stack { direction } => Layout::Stack {
            direction: if direction == "horizontal" { Direction::Horizontal } else { Direction::Vertical }
        },
        LayoutJson::Gallery => Layout::Gallery,
        LayoutJson::Table => Layout::Table,
        LayoutJson::Kanban { group_by } => Layout::Kanban { group_by: PropKey::from(group_by.as_str()) },
        LayoutJson::Widget { name } => Layout::Widget { name },
    }
}

// ── Graph load/save ───────────────────────────────────────────────────────────

/// Charge tous les nodes depuis `.kye/nodes/*.json` et reconstruit le Graph.
pub fn deserialize_graph(fs: &WorkspaceFs) -> Result<Graph, RepositoryError> {
    let files = fs.list_node_files()?;
    let mut all_nodes = HashMap::new();

    // 1. Charger tous les NodeJson en mémoire
    for path in files {
        let content = fs.read_file(&path)?;
        let node_json: NodeJson = serde_json::from_str(&content)
            .map_err(|e| RepositoryError::Corrupted(format!("{}: {}", path.display(), e)))?;
        all_nodes.insert(NodeId::from_uuid(node_json.id), node_json);
    }

    let mut graph = Graph::new();

    // 2. Identifier les racines et les ordonner par date de création (faute de mieux pour l'instant)
    let mut roots: Vec<NodeId> = all_nodes.values()
        .filter(|j| j.parent.is_none())
        .map(|j| NodeId::from_uuid(j.id))
        .collect();
    
    // Trier les racines par titre alphabétique
    roots.sort_by(|a, b| {
        let title_a = all_nodes.get(a).and_then(|j| j.props.get("title")).and_then(|v| match v {
            ValueJson::Text(t) => Some(t.as_str()),
            _ => None,
        }).unwrap_or("");
        let title_b = all_nodes.get(b).and_then(|j| j.props.get("title")).and_then(|v| match v {
            ValueJson::Text(t) => Some(t.as_str()),
            _ => None,
        }).unwrap_or("");
        
        title_a.to_lowercase().cmp(&title_b.to_lowercase())
            .then_with(|| {
                // Fallback sur la date de création si titres identiques
                let ca = all_nodes.get(a).map(|j| j.created_at).unwrap_or_else(Utc::now);
                let cb = all_nodes.get(b).map(|j| j.created_at).unwrap_or_else(Utc::now);
                ca.cmp(&cb)
            })
    });

    // 3. Reconstruire la hiérarchie en partant des racines (BFS)
    // On utilise un VecDeque pour un parcours en largeur, ou un Vec pour un parcours en profondeur.
    // L'important est de traiter les enfants dans l'ordre défini par le parent.
    let mut todo: std::collections::VecDeque<NodeId> = roots.into_iter().collect();
    let mut processed = std::collections::HashSet::new();

    while let Some(id) = todo.pop_front() {
        if processed.contains(&id) { continue; }
        
        if let Some(mut j) = all_nodes.remove(&id) {
            let parent_id = j.parent.map(NodeId::from_uuid);
            let children_ids = j.children.clone();
            
            // On vide les enfants du JSON car Graph::insert_child/root les reconstruira
            // lors de l'insertion de chaque enfant.
            j.children.clear();
            let node = json_to_node(j);

            if let Some(pid) = parent_id {
                if graph.contains(pid) {
                    let index = graph.get(pid).unwrap().children.len();
                    graph.insert_child(node, pid, index)
                        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                } else {
                    // Parent manquant ? On insère en root pour ne pas perdre le nœud
                    graph.insert_root(node)
                        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                }
            } else {
                graph.insert_root(node)
                    .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
            }

            processed.insert(id);

            // Ajouter les enfants à traiter
            for cid in children_ids {
                todo.push_back(NodeId::from_uuid(cid));
            }
        }
    }

    // 4. Gérer les nœuds orphelins (cycles ou branches détachées)
    // S'il reste des nœuds dans all_nodes, ils ne sont pas atteignables depuis les roots.
    let remaining_ids: Vec<NodeId> = all_nodes.keys().cloned().collect();
    for id in remaining_ids {
        if let Some(mut j) = all_nodes.remove(&id) {
            j.children.clear();
            let node = json_to_node(j);
            let _ = graph.insert_root(node); // On insère en root par sécurité
        }
    }

    Ok(graph)
}

/// Sérialise le graph complet sur disk (un fichier JSON par node).
pub fn serialize_graph(fs: &WorkspaceFs, graph: &Graph) -> Result<(), RepositoryError> {
    fs.init()?;
    for node in graph.iter() {
        serialize_node(fs, node)?;
    }
    Ok(())
}

pub fn serialize_node(fs: &WorkspaceFs, node: &Node) -> Result<(), RepositoryError> {
    let json = node_to_json(node);
    let content = serde_json::to_string_pretty(&json)
        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
    fs.write_file(&fs.node_path(&node.id.to_string()), &content)
}

/// Flush granulaire — sérialise seulement les nodes affectés par l'Event.
pub fn serialize_event(fs: &WorkspaceFs, event: &Event, graph: &Graph) -> Result<(), RepositoryError> {
    match event {
        Event::NodeCreated { node, .. } => {
            serialize_node(fs, node)?;
            // Mettre à jour le parent pour persister sa liste de children
            if let Some(pid) = node.parent {
                if let Some(p) = graph.get(pid) {
                    serialize_node(fs, p)?;
                }
            }
        }
        Event::NodeDeleted { nodes, old_parent, .. } => {
            for node in nodes {
                fs.delete_node_file(&node.id.to_string())?;
            }
            // Mettre à jour le parent pour persister le retrait de l'enfant
            if let Some(pid) = old_parent {
                if let Some(p) = graph.get(*pid) {
                    serialize_node(fs, p)?;
                }
            }
        }
        Event::NodeMoved { node_id, old_parent, new_parent, .. } => {
            // Mettre à jour le node déplacé et ses anciens/nouveaux parents
            if let Some(node) = graph.get(*node_id) { serialize_node(fs, node)?; }
            if let Some(pid) = old_parent {
                if let Some(p) = graph.get(*pid) { serialize_node(fs, p)?; }
            }
            if let Some(pid) = new_parent {
                if let Some(p) = graph.get(*pid) { serialize_node(fs, p)?; }
            }
        }
        Event::PropSet { node_id, .. }
        | Event::PropDeleted { node_id, .. }
        | Event::PropsSet { node_id, .. }
        | Event::ViewOverrideSet { node_id, .. } => {
            if let Some(node) = graph.get(*node_id) { serialize_node(fs, node)?; }
        }
        Event::KindSet { node_id, .. } => {
            if let Some(node) = graph.get(*node_id) { serialize_node(fs, node)?; }
        }
        Event::Batch(events) => {
            for e in events {
                serialize_event(fs, e, graph)?;
            }
        }
    }
    Ok(())
}

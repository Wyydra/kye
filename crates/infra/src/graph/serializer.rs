use std::collections::HashMap;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use std::path::PathBuf;

use domain::command::Event;
use domain::graph::Graph;
use domain::node::Node;
use domain::ports::RepositoryError;
use domain::primitives::{NodeId, PropKey};
use domain::value::{Value, FloatBits, Color, RichText, Span, Mark, Props};
use super::formatters::{REGISTRY, block as md_block};
use domain::view::{Direction, Layout, ViewDef};
use domain::workspace::WorkspaceMeta;

use crate::fs::WorkspaceFs;
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

// We reuse some JSON types for YAML frontmatter
#[derive(Serialize, Deserialize)]
struct Frontmatter {
    id: Uuid,
    kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    parent: Option<Uuid>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    children: Vec<Uuid>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    view_override: Option<ViewDefJson>,
    #[serde(flatten, default)]
    props: HashMap<String, serde_yaml::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
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
    Date(String),
    DateTime(String),
    Color(String),
}

#[derive(Serialize, Deserialize, Clone)]
struct RichTextJson {
    spans: Vec<SpanJson>,
}

#[derive(Serialize, Deserialize, Clone)]
struct SpanJson {
    text: String,
    marks: Vec<MarkJson>,
}

#[derive(Serialize, Deserialize, Clone)]
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

fn value_to_yaml(v: &Value) -> serde_yaml::Value {
    match v {
        Value::Null => serde_yaml::Value::Null,
        Value::Bool(b) => serde_yaml::Value::Bool(*b),
        Value::Int(i) => serde_yaml::Value::Number((*i).into()),
        Value::Float(f) => serde_yaml::Value::Number(serde_yaml::Number::from(f.0)),
        Value::Text(s) => serde_yaml::Value::String(s.as_ref().to_string()),
        Value::Array(arr) => serde_yaml::Value::Sequence(arr.iter().map(value_to_yaml).collect()),
        _ => serde_yaml::to_value(value_to_json(v)).unwrap_or(serde_yaml::Value::Null),
    }
}

fn yaml_to_value(y: serde_yaml::Value) -> Value {
    match y {
        serde_yaml::Value::Null => Value::Null,
        serde_yaml::Value::Bool(b) => Value::Bool(b),
        serde_yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Int(i)
            } else if let Some(f) = n.as_f64() {
                Value::Float(FloatBits(f))
            } else {
                Value::Null
            }
        }
        serde_yaml::Value::String(s) => {
            Value::Text(Arc::from(s.as_str()))
        }
        serde_yaml::Value::Sequence(seq) => {
            Value::Array(seq.into_iter().map(yaml_to_value).collect())
        }
        serde_yaml::Value::Mapping(map) => {
            if let Ok(vj) = serde_yaml::from_value::<ValueJson>(serde_yaml::Value::Mapping(map.clone())) {
                json_to_value(vj)
            } else {
                Value::Null
            }
        }
        _ => Value::Null,
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

#[derive(Serialize, Deserialize, Clone)]
struct ViewDefJson {
    layout: LayoutJson,
    bindings: HashMap<String, String>,
    actions: Vec<ActionDefJson>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "t", content = "v")]
enum LayoutJson {
    Document, Canvas, Grid { columns: u32 }, Stack { direction: String },
    Gallery, Table, Kanban { group_by: String }, Widget { name: String },
}

#[derive(Serialize, Deserialize, Clone)]
struct ActionDefJson {
    id: String, label: String, kind: String,
}

fn view_to_json(v: &ViewDef) -> ViewDefJson {
    ViewDefJson {
        layout: layout_to_json(&v.layout),
        bindings: v.bindings.iter().map(|(k, v)| (k.clone(), v.as_str().to_string())).collect(),
        actions: v.actions.iter().map(|a| ActionDefJson {
            id: a.id.clone(), label: a.label.clone(), kind: "custom".to_string(),
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
            direction: match direction { Direction::Vertical => "vertical".to_string(), Direction::Horizontal => "horizontal".to_string() }
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

fn is_document(node: &Node) -> bool {
    node.parent.is_none() || matches!(node.kind.as_str(), "core.page" | "core.canvas" | "core.database")
}

fn sanitize_title(title: &str) -> String {
    title.replace(&['/', '\\', ':', '*', '?', '"', '<', '>', '|'][..], "")
}

pub fn serialize_graph(fs: &WorkspaceFs, graph: &Graph, path_map: &std::sync::RwLock<HashMap<NodeId, PathBuf>>) -> Result<(), RepositoryError> {
    for node in graph.iter() {
        if is_document(node) {
            serialize_document(fs, graph, node, path_map)?;
        }
    }
    Ok(())
}

fn serialize_document(fs: &WorkspaceFs, graph: &Graph, node: &Node, path_map: &std::sync::RwLock<HashMap<NodeId, PathBuf>>) -> Result<(), RepositoryError> {
    let formatter = REGISTRY.get_by_kind(node.kind.as_str());
    
    let mut props = HashMap::new();
    let native_keys = formatter.native_keys();
    
    for (k, v) in &node.props {
        if k.as_str() != "title" && !native_keys.contains(&k.as_str()) {
            props.insert(k.as_str().to_string(), value_to_yaml(v));
        }
    }

    let frontmatter = Frontmatter {
        id: node.id.as_uuid(),
        kind: node.kind.as_str().to_string(),
        parent: node.parent.map(|id| id.as_uuid()),
        children: node.children.iter().map(|id| id.as_uuid()).collect(),
        created_at: node.created_at,
        updated_at: node.updated_at,
        view_override: node.view_override.as_ref().map(view_to_json),
        props,
    };

    let yaml = serde_yaml::to_string(&frontmatter).map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
    
    // The domain guarantees unique titles, so we just read it directly.
    let title = node.title().unwrap_or("Untitled").trim();
    let safe_title = if title.is_empty() { "Untitled".to_string() } else { sanitize_title(title) };
    
    let mut markdown = format!("---\n{}---\n", yaml);

    if node.kind.as_str() == "core.page" && !title.is_empty() {
        markdown.push_str(&format!("# {}\n\n", title));
    }

    if node.kind.as_str() == "core.page" {
        for child_id in &node.children {
            if let Some(child) = graph.get(*child_id) {
                if !is_document(child) {
                    serialize_block(&mut markdown, child);
                }
            }
        }
    } else {
        markdown.push_str(&formatter.format(&node.props));
        markdown.push_str("\n\n");
    }

    // Resolve a filename that doesn't collide with any already-claimed path.
    // The path_map covers ALL nodes (pages, images, etc.), so this correctly
    // avoids overwriting files of any kind, not just pages.
    let mut map = path_map.write().unwrap();
    let old_path_opt = map.get(&node.id).cloned();
    
    let claimed: Vec<&PathBuf> = map.iter()
        .filter(|(id, _)| **id != node.id)
        .map(|(_, p)| p)
        .collect();
    
    let new_path = {
        let base_path = fs.root.join(format!("{}.md", safe_title));
        if old_path_opt.as_deref() == Some(&base_path) || !claimed.contains(&&base_path) && !base_path.exists() {
            base_path
        } else {
            let mut counter = 1u32;
            loop {
                let candidate = fs.root.join(format!("{} {}.md", safe_title, counter));
                if old_path_opt.as_deref() == Some(&candidate) || !claimed.contains(&&candidate) && !candidate.exists() {
                    break candidate;
                }
                counter += 1;
            }
        }
    };

    // Handle file rename: if the title changed, remove the old file.
    if let Some(old_path) = old_path_opt {
        if old_path != new_path && old_path.exists() {
            let _ = std::fs::remove_file(old_path);
        }
    }
    map.insert(node.id, new_path.clone());

    // Update the node's title prop to match the resolved filename, so the
    // in-memory graph and the sidebar reflect the actual filename.
    let resolved_title = new_path.file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(&safe_title)
        .to_string();
    
    let markdown_with_title = if node.kind.as_str() == "core.page" && resolved_title != safe_title {
        // Title was bumped (e.g. "Untitled" -> "Untitled 1"): rewrite the H1
        markdown.replacen(&format!("# {}\n", safe_title), &format!("# {}\n", resolved_title), 1)
    } else {
        markdown
    };

    fs.write_file(&new_path, &markdown_with_title)
}

fn serialize_block(out: &mut String, node: &Node) {
    let formatter = REGISTRY.get_by_kind(node.kind.as_str());
    let native_keys = formatter.native_keys();

    let hidden_props: HashMap<String, serde_yaml::Value> = node.props
        .iter()
        .filter(|(k, _)| !native_keys.contains(&k.as_str()))
        .map(|(k, v)| (k.as_str().to_string(), value_to_yaml(v)))
        .collect();

    let native_text = formatter.format(&node.props);
    let line = md_block::serialize_block_line(node.id, &native_text, hidden_props);
    out.push_str(&line);
    out.push_str("\n\n");
}

pub fn deserialize_graph(fs: &WorkspaceFs) -> Result<(Graph, HashMap<NodeId, PathBuf>), RepositoryError> {
    let files = fs.list_node_files()?;
    let mut all_nodes = HashMap::new();
    let mut path_map = HashMap::new();

    for path in files {
        if let Ok(content) = fs.read_file(&path) {
            let parsed_nodes = parse_markdown_document(&content, &path);
            if let Some(root) = parsed_nodes.first() {
                path_map.insert(root.id, path.clone());
            }
            for node in parsed_nodes {
                all_nodes.insert(node.id, node);
            }
        }
    }

    let mut graph = Graph::new();
    
    let roots: Vec<NodeId> = all_nodes.values()
        .filter(|n| n.parent.is_none())
        .map(|n| n.id)
        .collect();

    let mut todo: std::collections::VecDeque<NodeId> = roots.into_iter().collect();
    let mut processed = std::collections::HashSet::new();

    while let Some(id) = todo.pop_front() {
        if processed.contains(&id) { continue; }

        if let Some(mut node) = all_nodes.remove(&id) {
            let parent_id = node.parent;
            let children_ids = node.children.clone();
            node.children.clear();

            if let Some(pid) = parent_id {
                if graph.contains(pid) {
                    let index = graph.get(pid).unwrap().children.len();
                    graph.insert_child(node, pid, index)
                        .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                } else {
                    graph.insert_root(node).map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                }
            } else {
                graph.insert_root(node).map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
            }

            processed.insert(id);
            for cid in children_ids {
                todo.push_back(cid);
            }
        }
    }

    let remaining_ids: Vec<NodeId> = all_nodes.keys().cloned().collect();
    for id in remaining_ids {
        if let Some(mut node) = all_nodes.remove(&id) {
            node.children.clear();
            let _ = graph.insert_root(node); 
        }
    }

    Ok((graph, path_map))
}

/// Split a Markdown body into top-level block strings.
///
/// Unlike `str::split("\n\n")`, this correctly handles fenced code blocks that
/// contain blank lines internally. We use pulldown-cmark's offset iterator to
/// detect top-level block boundaries and extract the corresponding raw text
/// slices — preserving trailing HTML metadata comments (`<!-- id: … -->`).
fn split_blocks(body: &str) -> Vec<String> {
    use pulldown_cmark::{Event, Options, Parser};

    let mut blocks: Vec<String> = Vec::new();
    let mut depth: usize = 0;
    let mut block_start: Option<usize> = None;

    for (event, range) in Parser::new_ext(body, Options::empty()).into_offset_iter() {
        match event {
            Event::Start(_) => {
                if depth == 0 {
                    block_start = Some(range.start);
                }
                depth += 1;
            }
            Event::End(_) => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    if let Some(start) = block_start.take() {
                        // The parsed range ends at the last significant character.
                        // Scan forward to also include any trailing inline HTML comment
                        // (`<!-- id: … -->`) that lives on the same line.
                        let rest = &body[range.end..];
                        let extra = rest
                            .find('\n')
                            .map(|n| n + 1) // include the newline itself
                            .unwrap_or(rest.len());
                        let raw = body[start..range.end + extra].trim().to_string();
                        if !raw.is_empty() {
                            blocks.push(raw);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    blocks
}

fn parse_markdown_document(content: &str, path: &std::path::Path) -> Vec<Node> {
    let mut nodes = Vec::new();
    let mut body_start = 0;
    let mut parent_node = None;
    
    if content.starts_with("---\n") {
        if let Some(end_idx) = content[4..].find("\n---\n") {
            let yaml_str = &content[4..4 + end_idx];
            body_start = 4 + end_idx + 5;
            if let Ok(front) = serde_yaml::from_str::<Frontmatter>(yaml_str) {
                use domain::node::NodeBuilder;
                let mut props = Props::new();
                for (k, v) in front.props {
                    props.insert(PropKey::from(k.as_str()), yaml_to_value(v));
                }
                
                let mut node = NodeBuilder::new(front.kind.as_str(), front.created_at)
                    .with_id(NodeId::from_uuid(front.id))
                    .with_props(props)
                    .build();
                    
                node.parent = front.parent.map(NodeId::from_uuid);
                node.children = front.children.into_iter().map(NodeId::from_uuid).collect();
                node.updated_at = front.updated_at;
                node.view_override = front.view_override.map(json_to_view);
                
                parent_node = Some(node.clone());
            }
        }
    }
    
    let body_text = if body_start < content.len() { &content[body_start..] } else { "" };
    
    if let Some(mut parent) = parent_node {
        if parent.kind.as_str() == "core.page" {
            let fallback_title = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Untitled");
            
            if !body_text.trim().is_empty() {
                let raw_blocks = split_blocks(body_text);
                let mut parsed_children = Vec::new();
                let mut blocks = raw_blocks.iter().peekable();

                if let Some(first) = blocks.peek() {
                    if first.starts_with("# ") && !first.contains("<!-- id:") {
                        let doc_title = first[2..].trim();
                        parent.props.insert(PropKey::from("title"), Value::Text(Arc::from(doc_title)));
                        blocks.next();
                    } else if !parent.props.contains_key(&PropKey::from("title")) {
                        parent.props.insert(PropKey::from("title"), Value::Text(Arc::from(fallback_title)));
                    }
                } else if !parent.props.contains_key(&PropKey::from("title")) {
                    parent.props.insert(PropKey::from("title"), Value::Text(Arc::from(fallback_title)));
                }

                for raw_block in blocks {
                    let raw_block = raw_block.trim();
                    if raw_block.is_empty() { continue; }

                    let parsed = md_block::ParsedBlock::parse(raw_block);
                    let formatter = REGISTRY.get_by_text(&parsed.markdown_text);

                    // Merge native props (from Markdown syntax) with hidden props
                    // (from the HTML comment), giving priority to hidden props so
                    // that manually added metadata survives round-trips.
                    let mut props = formatter.extract(&parsed.markdown_text);
                    for (k, v) in parsed.hidden_props {
                        props.insert(PropKey::from(k.as_str()), yaml_to_value(v));
                    }

                    use domain::node::NodeBuilder;
                    let child = NodeBuilder::new(formatter.kind(), Utc::now())
                        .with_id(parsed.node_id)
                        .with_parent(parent.id)
                        .with_props(props)
                        .build();

                    parsed_children.push(child.id);
                    nodes.push(child);
                }
                
                parent.children = parsed_children;
            } else if !parent.props.contains_key(&PropKey::from("title")) {
                parent.props.insert(PropKey::from("title"), Value::Text(Arc::from(fallback_title)));
            }
        } else {
            let fallback_title = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Untitled");
            if !parent.props.contains_key(&PropKey::from("title")) {
                parent.props.insert(PropKey::from("title"), Value::Text(Arc::from(fallback_title)));
            }
            if !body_text.trim().is_empty() {
                let formatter = REGISTRY.get_by_kind(parent.kind.as_str());
                let extracted = formatter.extract(body_text.trim());
                for (k, v) in extracted {
                    parent.props.insert(k, v);
                }
            }
        }
        nodes.insert(0, parent);
    }
    
    nodes
}

pub fn serialize_event(fs: &WorkspaceFs, event: &Event, graph: &Graph, path_map: &std::sync::RwLock<HashMap<NodeId, PathBuf>>) -> Result<(), RepositoryError> {
    // In markdown, if a block changes, we reserialize its parent document.
    let mut docs_to_save = std::collections::HashSet::new();

    let mut collect_doc = |id: NodeId| {
        if let Some(node) = graph.get(id) {
            if is_document(node) {
                docs_to_save.insert(id);
            } else if let Some(pid) = node.parent {
                if let Some(p) = graph.get(pid) {
                    if is_document(p) {
                        docs_to_save.insert(pid);
                    }
                }
            }
        }
    };

    match event {
        Event::NodeCreated { node, .. } => collect_doc(node.id),
        Event::NodeDeleted { old_parent, .. } => {
            if let Some(pid) = old_parent {
                collect_doc(*pid);
            }
        }
        Event::NodeMoved { node_id, old_parent, new_parent, .. } => {
            collect_doc(*node_id);
            if let Some(pid) = old_parent { collect_doc(*pid); }
            if let Some(pid) = new_parent { collect_doc(*pid); }
        }
        Event::PropSet { node_id, .. } | Event::PropDeleted { node_id, .. } | Event::PropsSet { node_id, .. } | Event::ViewOverrideSet { node_id, .. } | Event::KindSet { node_id, .. } => {
            collect_doc(*node_id);
        }
        Event::Batch(events) => {
            // Recurse or collect
            for e in events {
                serialize_event(fs, e, graph, path_map)?;
            }
        }
    }

    for id in docs_to_save {
        if let Some(node) = graph.get(id) {
            serialize_document(fs, graph, node, path_map)?;
        }
    }

    if let Event::NodeDeleted { nodes, .. } = event {
        let mut map = path_map.write().unwrap();
        for n in nodes {
            if let Some(path) = map.remove(&n.id) {
                if path.exists() {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
    }

    Ok(())
}

pub fn load_tombstones(fs: &WorkspaceFs) -> Result<HashMap<NodeId, DateTime<Utc>>, RepositoryError> {
    let path = fs.kye_dir().join("tombstones.json");
    if !path.exists() {
        return Ok(HashMap::new());
    }
    let content = match fs.read_file(&path) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Failed to read tombstones.json: {:?}", e);
            return Ok(HashMap::new());
        }
    };
    let raw: HashMap<String, String> = match serde_json::from_str(&content) {
        Ok(m) => m,
        Err(e) => {
            tracing::error!("Failed to parse tombstones.json: {:?}. Backing up and resetting.", e);
            let backup_path = fs.kye_dir().join("tombstones.json.corrupted");
            let _ = std::fs::rename(&path, &backup_path);
            HashMap::new()
        }
    };
    
    let mut tombstones = HashMap::new();
    for (k, v) in raw {
        if let Ok(uuid) = Uuid::parse_str(&k) {
            if let Ok(dt) = DateTime::parse_from_rfc3339(&v) {
                tombstones.insert(NodeId::from_uuid(uuid), dt.with_timezone(&Utc));
            }
        }
    }
    Ok(tombstones)
}

pub fn save_tombstones(fs: &WorkspaceFs, tombstones: &HashMap<NodeId, DateTime<Utc>>) -> Result<(), RepositoryError> {
    let mut raw = HashMap::new();
    for (k, v) in tombstones {
        raw.insert(k.to_string(), v.to_rfc3339());
    }
    let content = serde_json::to_string_pretty(&raw)
        .map_err(|e| RepositoryError::Corrupted(format!("Failed to serialize tombstones: {}", e)))?;
    fs.write_file(&fs.kye_dir().join("tombstones.json"), &content)
}


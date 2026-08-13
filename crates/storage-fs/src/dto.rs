use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use domain::command::{Command, Event};
use domain::graph::Graph;
use domain::node::Node;
use domain::primitives::{Kind, NodeId, PropKey};

use domain::occurrence::{DetailLevel, NodeOccurrence};
use domain::value::{Color, FloatBits, Mark, Props, RichText, Span, Value};
use domain::view::{
    ActionDef, ActionKind, CanvasLayout, CollectionLayout, DataSource, DocumentLayout, Surface,
    ViewDef, ViewOverlay,
};
use domain::workspace::WorkspaceMeta;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WorkspaceMetaDto {
    pub id: String,
    pub name: String,
    pub default_remote: Option<String>,
    pub remotes: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RemoteDto {
    pub name: String,
    pub url: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct GraphDto {
    pub nodes: HashMap<String, NodeDto>,
    pub roots: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NodeDto {
    pub id: String,
    pub kind: String,
    pub parent: Option<String>,
    pub children: Vec<String>,
    pub props: HashMap<String, ValueDto>,
    pub created_at: String,
    pub updated_at: String,
    pub view_override: Option<ViewDefDto>,
}

impl NodeDto {
    pub fn from_node_in_graph(node: &Node, graph: &Graph) -> Self {
        Self {
            id: node.id.to_string(),
            kind: node.kind.as_str().to_string(),
            parent: graph.parent_of(node.id).map(|id| id.to_string()),
            children: graph
                .children_of(node.id)
                .map(|c| c.id.to_string())
                .collect(),
            props: node
                .props
                .iter()
                .map(|(k, v)| (k.as_str().to_string(), ValueDto::from(v)))
                .collect(),
            created_at: node.created_at.to_rfc3339(),
            updated_at: node.updated_at.to_rfc3339(),
            view_override: node.view_override.as_ref().map(ViewDefDto::from),
        }
    }
}

impl From<&Node> for NodeDto {
    fn from(node: &Node) -> Self {
        Self {
            id: node.id.to_string(),
            kind: node.kind.as_str().to_string(),
            parent: None,
            children: Vec::new(),
            props: node
                .props
                .iter()
                .map(|(k, v)| (k.as_str().to_string(), ValueDto::from(v)))
                .collect(),
            created_at: node.created_at.to_rfc3339(),
            updated_at: node.updated_at.to_rfc3339(),
            view_override: node.view_override.as_ref().map(ViewDefDto::from),
        }
    }
}

impl From<&Graph> for GraphDto {
    fn from(graph: &Graph) -> Self {
        Self {
            nodes: graph
                .iter()
                .map(|n| (n.id.to_string(), NodeDto::from_node_in_graph(n, graph)))
                .collect(),
            roots: graph.roots().iter().map(|id| id.to_string()).collect(),
        }
    }
}

impl GraphDto {
    pub fn to_graph(&self) -> Graph {
        use chrono::{DateTime, Utc};
        use domain::node::NodeBuilder;
        use domain::primitives::PropKey;
        use domain::value::{Props, Value};
        use domain::view::ViewDef;

        let mut graph = Graph::new();
        let mut node_parents: HashMap<NodeId, NodeId> = HashMap::new();

        for (node_id_str, node_dto) in &self.nodes {
            let mut props = Props::new();
            for (k, v) in &node_dto.props {
                props.insert(PropKey::from(k.as_str()), Value::from(v.clone()));
            }

            let node_id = NodeId::from_uuid(
                uuid::Uuid::parse_str(node_id_str).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            );

            let created_at = DateTime::parse_from_rfc3339(&node_dto.created_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            let mut node = NodeBuilder::new(&node_dto.kind, created_at)
                .with_id(node_id)
                .with_props(props)
                .build();

            node.updated_at = DateTime::parse_from_rfc3339(&node_dto.updated_at)
                .map(|dt| dt.with_timezone(&Utc))
                .unwrap_or_else(|_| Utc::now());

            if let Some(vo_dto) = &node_dto.view_override {
                node.view_override = Some(ViewDef::from(vo_dto.clone()));
            }

            if let Some(parent_str) = &node_dto.parent
                && let Ok(p_uuid) = uuid::Uuid::parse_str(parent_str)
            {
                node_parents.insert(node_id, NodeId::from_uuid(p_uuid));
            }

            let _ = graph.insert_root(node);
        }

        for (child_id, parent_id) in node_parents {
            if graph.get(parent_id).is_some() {
                let _ = graph.move_node(child_id, Some(parent_id), usize::MAX);
            }
        }

        graph
    }
}

impl From<&WorkspaceMeta> for WorkspaceMetaDto {
    fn from(meta: &WorkspaceMeta) -> Self {
        Self {
            id: meta.id.to_string(),
            name: meta.name.clone(),
            default_remote: meta.default_remote.as_ref().map(|n| n.as_str().to_string()),
            remotes: meta
                .remotes
                .iter()
                .map(|(k, v)| (k.as_str().to_string(), v.as_str().to_string()))
                .collect(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum ValueDto {
    Null,
    Bool(bool),
    Int(i64),
    Float(f64),
    Text(String),
    Rich(RichTextDto),
    Ref(String),
    Array(Vec<ValueDto>),
    Date(String),
    DateTime(String),
    Color(String),
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RichTextDto {
    pub spans: Vec<SpanDto>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SpanDto {
    pub text: String,
    pub marks: Vec<MarkDto>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum MarkDto {
    Bold,
    Italic,
    Code,
    Strikethrough,
    Underline,
    Link(String),
    Color(String),
    Ref(String),
}

impl From<&Value> for ValueDto {
    fn from(v: &Value) -> Self {
        match v {
            Value::Null => ValueDto::Null,
            Value::Bool(b) => ValueDto::Bool(*b),
            Value::Int(i) => ValueDto::Int(*i),
            Value::Float(f) => ValueDto::Float(f.0),
            Value::Text(s) => ValueDto::Text(s.as_ref().to_string()),
            Value::Rich(rt) => ValueDto::Rich(RichTextDto {
                spans: rt
                    .0
                    .iter()
                    .map(|s| SpanDto {
                        text: s.text.as_ref().to_string(),
                        marks: s.marks.iter().map(MarkDto::from).collect(),
                    })
                    .collect(),
            }),
            Value::Ref(id) => ValueDto::Ref(id.to_string()),
            Value::Array(arr) => ValueDto::Array(arr.iter().map(ValueDto::from).collect()),
            Value::Date(d) => ValueDto::Date(d.to_string()),
            Value::DateTime(dt) => ValueDto::DateTime(dt.to_rfc3339()),
            Value::Color(c) => ValueDto::Color(c.as_str().to_string()),
        }
    }
}

impl From<ValueDto> for Value {
    fn from(dto: ValueDto) -> Self {
        match dto {
            ValueDto::Null => Value::Null,
            ValueDto::Bool(b) => Value::Bool(b),
            ValueDto::Int(i) => Value::Int(i),
            ValueDto::Float(f) => Value::Float(FloatBits(f)),
            ValueDto::Text(s) => Value::Text(s.into()),
            ValueDto::Rich(rt) => Value::Rich(RichText(
                rt.spans
                    .into_iter()
                    .map(|s| Span {
                        text: s.text.into(),
                        marks: s
                            .marks
                            .into_iter()
                            .map(|m| match m {
                                MarkDto::Bold => Mark::Bold,
                                MarkDto::Italic => Mark::Italic,
                                MarkDto::Code => Mark::Code,
                                MarkDto::Strikethrough => Mark::Strikethrough,
                                MarkDto::Underline => Mark::Underline,
                                MarkDto::Link(url) => Mark::Link(url.into()),
                                MarkDto::Color(c) => Mark::Color(Color::new(&c)),
                                MarkDto::Ref(id) => Mark::Ref(NodeId::from_uuid(
                                    uuid::Uuid::parse_str(&id).unwrap_or_default(),
                                )),
                            })
                            .collect(),
                    })
                    .collect(),
            )),
            ValueDto::Ref(id) => Value::Ref(NodeId::from_uuid(
                uuid::Uuid::parse_str(&id).unwrap_or_default(),
            )),
            ValueDto::Array(arr) => Value::Array(arr.into_iter().map(Value::from).collect()),
            ValueDto::Date(d) => Value::Date(d.parse().unwrap_or_default()),
            ValueDto::DateTime(dt) => Value::DateTime(
                chrono::DateTime::parse_from_rfc3339(&dt)
                    .map(|dt| dt.with_timezone(&chrono::Utc))
                    .unwrap_or_default(),
            ),
            ValueDto::Color(c) => Value::Color(Color::new(&c)),
        }
    }
}

impl From<&Mark> for MarkDto {
    fn from(m: &Mark) -> Self {
        match m {
            Mark::Bold => MarkDto::Bold,
            Mark::Italic => MarkDto::Italic,
            Mark::Code => MarkDto::Code,
            Mark::Strikethrough => MarkDto::Strikethrough,
            Mark::Underline => MarkDto::Underline,
            Mark::Link(url) => MarkDto::Link(url.as_ref().to_string()),
            Mark::Color(c) => MarkDto::Color(c.as_str().to_string()),
            Mark::Ref(id) => MarkDto::Ref(id.to_string()),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ViewDefDto {
    pub surface: SurfaceDto,
    pub source: DataSourceDto,
    pub overlay: ViewOverlayDto,
    pub bindings: HashMap<String, String>,
    pub actions: Vec<ActionDefDto>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum SurfaceDto {
    Document {
        layout: DocumentLayoutDto,
    },
    Canvas {
        layout: CanvasLayoutDto,
        diagram_kind: Option<String>,
    },
    Collection {
        layout: CollectionLayoutDto,
    },
    Widget {
        name: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum DocumentLayoutDto {
    VerticalStream,
    Columns { count: u8 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum CanvasLayoutDto {
    Absolute,
    AutoTree,
    ForceDirected,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum CollectionLayoutDto {
    Table { columns: Vec<String> },
    Kanban { group_by: String },
    Gallery,
    List,
    Matrix { edge_kind: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "t", content = "v")]
pub enum DataSourceDto {
    DirectChildren,
    PersistedQuery {
        query_node_id: String,
    },
    DualQuery {
        row_query_node_id: String,
        col_query_node_id: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct ViewOverlayDto {
    pub hidden_edge_kinds: Vec<String>,
    pub focus_node_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NodeOccurrenceDto {
    pub id: String,
    pub node_id: String,
    pub canvas_id: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub z_index: i32,
    pub detail_level: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActionDefDto {
    pub id: String,
    pub label: String,
    pub kind: String,
}

impl From<&ViewDef> for ViewDefDto {
    fn from(v: &ViewDef) -> Self {
        Self {
            surface: SurfaceDto::from(&v.surface),
            source: DataSourceDto::from(&v.source),
            overlay: ViewOverlayDto::from(&v.overlay),
            bindings: v
                .bindings
                .iter()
                .map(|(k, v)| (k.as_str().to_string(), v.as_str().to_string()))
                .collect(),
            actions: v.actions.iter().map(ActionDefDto::from).collect(),
        }
    }
}

impl From<ViewDefDto> for ViewDef {
    fn from(dto: ViewDefDto) -> Self {
        let mut view = ViewDef::new(Surface::from(dto.surface))
            .with_source(DataSource::from(dto.source))
            .with_overlay(ViewOverlay::from(dto.overlay));
        for (k, v) in dto.bindings {
            view.bindings
                .insert(domain::view::SlotName::from(k), PropKey::from(v.as_str()));
        }
        for a in dto.actions {
            view.actions.push(ActionDef::from(a));
        }
        view
    }
}

impl From<&Surface> for SurfaceDto {
    fn from(s: &Surface) -> Self {
        match s {
            Surface::Document { layout } => SurfaceDto::Document {
                layout: DocumentLayoutDto::from(layout),
            },
            Surface::Canvas {
                layout,
                diagram_kind,
            } => SurfaceDto::Canvas {
                layout: CanvasLayoutDto::from(layout),
                diagram_kind: diagram_kind.as_ref().map(|d| d.as_str().to_string()),
            },
            Surface::Collection { layout } => SurfaceDto::Collection {
                layout: CollectionLayoutDto::from(layout),
            },
            Surface::Widget { name } => SurfaceDto::Widget {
                name: name.as_str().to_string(),
            },
        }
    }
}

impl From<SurfaceDto> for Surface {
    fn from(dto: SurfaceDto) -> Self {
        match dto {
            SurfaceDto::Document { layout } => Surface::Document {
                layout: DocumentLayout::from(layout),
            },
            SurfaceDto::Canvas {
                layout,
                diagram_kind,
            } => Surface::Canvas {
                layout: CanvasLayout::from(layout),
                diagram_kind: diagram_kind.map(domain::view::DiagramKind::from),
            },
            SurfaceDto::Collection { layout } => Surface::Collection {
                layout: CollectionLayout::from(layout),
            },
            SurfaceDto::Widget { name } => Surface::Widget {
                name: domain::view::WidgetName::from(name),
            },
        }
    }
}

impl From<&DocumentLayout> for DocumentLayoutDto {
    fn from(l: &DocumentLayout) -> Self {
        match l {
            DocumentLayout::VerticalStream => DocumentLayoutDto::VerticalStream,
            DocumentLayout::Columns { count } => DocumentLayoutDto::Columns { count: *count },
        }
    }
}

impl From<DocumentLayoutDto> for DocumentLayout {
    fn from(dto: DocumentLayoutDto) -> Self {
        match dto {
            DocumentLayoutDto::VerticalStream => DocumentLayout::VerticalStream,
            DocumentLayoutDto::Columns { count } => DocumentLayout::Columns { count },
        }
    }
}

impl From<&CanvasLayout> for CanvasLayoutDto {
    fn from(l: &CanvasLayout) -> Self {
        match l {
            CanvasLayout::Absolute => CanvasLayoutDto::Absolute,
            CanvasLayout::AutoTree => CanvasLayoutDto::AutoTree,
            CanvasLayout::ForceDirected => CanvasLayoutDto::ForceDirected,
        }
    }
}

impl From<CanvasLayoutDto> for CanvasLayout {
    fn from(dto: CanvasLayoutDto) -> Self {
        match dto {
            CanvasLayoutDto::Absolute => CanvasLayout::Absolute,
            CanvasLayoutDto::AutoTree => CanvasLayout::AutoTree,
            CanvasLayoutDto::ForceDirected => CanvasLayout::ForceDirected,
        }
    }
}

impl From<&CollectionLayout> for CollectionLayoutDto {
    fn from(l: &CollectionLayout) -> Self {
        match l {
            CollectionLayout::Table { columns } => CollectionLayoutDto::Table {
                columns: columns.iter().map(|c| c.as_str().to_string()).collect(),
            },
            CollectionLayout::Kanban { group_by } => CollectionLayoutDto::Kanban {
                group_by: group_by.as_str().to_string(),
            },
            CollectionLayout::Gallery => CollectionLayoutDto::Gallery,
            CollectionLayout::List => CollectionLayoutDto::List,
            CollectionLayout::Matrix { edge_kind } => CollectionLayoutDto::Matrix {
                edge_kind: edge_kind.as_str().to_string(),
            },
        }
    }
}

impl From<CollectionLayoutDto> for CollectionLayout {
    fn from(dto: CollectionLayoutDto) -> Self {
        match dto {
            CollectionLayoutDto::Table { columns } => CollectionLayout::Table {
                columns: columns
                    .into_iter()
                    .map(|c| PropKey::from(c.as_str()))
                    .collect(),
            },
            CollectionLayoutDto::Kanban { group_by } => CollectionLayout::Kanban {
                group_by: PropKey::from(group_by.as_str()),
            },
            CollectionLayoutDto::Gallery => CollectionLayout::Gallery,
            CollectionLayoutDto::List => CollectionLayout::List,
            CollectionLayoutDto::Matrix { edge_kind } => CollectionLayout::Matrix {
                edge_kind: Kind::from(edge_kind),
            },
        }
    }
}

impl From<&DataSource> for DataSourceDto {
    fn from(s: &DataSource) -> Self {
        match s {
            DataSource::DirectChildren => DataSourceDto::DirectChildren,
            DataSource::PersistedQuery { query_node_id } => DataSourceDto::PersistedQuery {
                query_node_id: query_node_id.to_string(),
            },
            DataSource::DualQuery {
                row_query_node_id,
                col_query_node_id,
            } => DataSourceDto::DualQuery {
                row_query_node_id: row_query_node_id.to_string(),
                col_query_node_id: col_query_node_id.to_string(),
            },
        }
    }
}

impl From<DataSourceDto> for DataSource {
    fn from(dto: DataSourceDto) -> Self {
        match dto {
            DataSourceDto::DirectChildren => DataSource::DirectChildren,
            DataSourceDto::PersistedQuery { query_node_id } => DataSource::PersistedQuery {
                query_node_id: NodeId::from_uuid(
                    uuid::Uuid::parse_str(&query_node_id).unwrap_or_default(),
                ),
            },
            DataSourceDto::DualQuery {
                row_query_node_id,
                col_query_node_id,
            } => DataSource::DualQuery {
                row_query_node_id: NodeId::from_uuid(
                    uuid::Uuid::parse_str(&row_query_node_id).unwrap_or_default(),
                ),
                col_query_node_id: NodeId::from_uuid(
                    uuid::Uuid::parse_str(&col_query_node_id).unwrap_or_default(),
                ),
            },
        }
    }
}

impl From<&ViewOverlay> for ViewOverlayDto {
    fn from(o: &ViewOverlay) -> Self {
        Self {
            hidden_edge_kinds: o
                .hidden_edge_kinds
                .iter()
                .map(|k| k.as_str().to_string())
                .collect(),
            focus_node_id: o.focus_node_id.map(|id| id.to_string()),
        }
    }
}

impl From<ViewOverlayDto> for ViewOverlay {
    fn from(dto: ViewOverlayDto) -> Self {
        Self {
            hidden_edge_kinds: dto.hidden_edge_kinds.into_iter().map(Kind::from).collect(),
            focus_node_id: dto
                .focus_node_id
                .map(|id| NodeId::from_uuid(uuid::Uuid::parse_str(&id).unwrap_or_default())),
        }
    }
}

impl From<&NodeOccurrence> for NodeOccurrenceDto {
    fn from(o: &NodeOccurrence) -> Self {
        Self {
            id: o.id.to_string(),
            node_id: o.node_id.to_string(),
            canvas_id: o.canvas_id.to_string(),
            x: o.x,
            y: o.y,
            width: o.width,
            height: o.height,
            z_index: o.z_index,
            detail_level: match o.detail_level {
                DetailLevel::Compact => "compact".to_string(),
                DetailLevel::Full => "full".to_string(),
                DetailLevel::Expanded => "expanded".to_string(),
            },
        }
    }
}

impl From<NodeOccurrenceDto> for NodeOccurrence {
    fn from(dto: NodeOccurrenceDto) -> Self {
        Self {
            id: uuid::Uuid::parse_str(&dto.id).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&dto.node_id).unwrap_or_default()),
            canvas_id: NodeId::from_uuid(uuid::Uuid::parse_str(&dto.canvas_id).unwrap_or_default()),
            x: dto.x,
            y: dto.y,
            width: dto.width,
            height: dto.height,
            z_index: dto.z_index,
            detail_level: match dto.detail_level.as_str() {
                "compact" => DetailLevel::Compact,
                "expanded" => DetailLevel::Expanded,
                _ => DetailLevel::Full,
            },
        }
    }
}

impl From<&ActionDef> for ActionDefDto {
    fn from(a: &ActionDef) -> Self {
        Self {
            id: a.id.as_str().to_string(),
            label: a.label.clone(),
            kind: match &a.kind {
                ActionKind::ToggleProp { prop } => format!("toggle_prop:{}", prop.as_str()),
                ActionKind::NavigateTo { node_id } => format!("navigate_to:{}", node_id),
                ActionKind::Custom { name } => name.clone(),
            },
        }
    }
}

impl From<ActionDefDto> for ActionDef {
    fn from(dto: ActionDefDto) -> Self {
        ActionDef {
            id: domain::view::ActionId::from(dto.id),
            label: dto.label,
            kind: ActionKind::Custom { name: dto.kind },
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CommandDto {
    CreateNode {
        id: String,
        kind: String,
        parent_id: Option<String>,
        index: usize,
        props: HashMap<String, ValueDto>,
    },
    DeleteNode {
        id: String,
        cascade: bool,
    },
    MoveNode {
        node_id: String,
        new_parent_id: Option<String>,
        new_index: usize,
    },
    SetProp {
        node_id: String,
        key: String,
        value: ValueDto,
    },
    DeleteProp {
        node_id: String,
        key: String,
    },
    SetProps {
        node_id: String,
        props: HashMap<String, ValueDto>,
    },
    SetViewOverride {
        node_id: String,
        view: Option<ViewDefDto>,
    },
    SetKind {
        node_id: String,
        new_kind: String,
    },
}

impl From<CommandDto> for Command {
    fn from(dto: CommandDto) -> Self {
        match dto {
            CommandDto::CreateNode {
                id,
                kind,
                parent_id,
                index,
                props,
            } => {
                let mut domain_props = Props::new();
                for (k, v) in props {
                    domain_props.insert(PropKey::from(k.as_str()), v.into());
                }
                Command::CreateNode {
                    id: NodeId::from_uuid(uuid::Uuid::parse_str(&id).unwrap_or_default()),
                    kind: Kind::from(kind),
                    parent_id: parent_id.map(|id| {
                        NodeId::from_uuid(uuid::Uuid::parse_str(&id).unwrap_or_default())
                    }),
                    index,
                    props: domain_props,
                }
            }
            CommandDto::DeleteNode { id, cascade } => Command::DeleteNode {
                id: NodeId::from_uuid(uuid::Uuid::parse_str(&id).unwrap_or_default()),
                cascade,
            },
            CommandDto::MoveNode {
                node_id,
                new_parent_id,
                new_index,
            } => Command::MoveNode {
                node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                new_parent_id: new_parent_id
                    .map(|id| NodeId::from_uuid(uuid::Uuid::parse_str(&id).unwrap_or_default())),
                new_index,
            },
            CommandDto::SetProp {
                node_id,
                key,
                value,
            } => Command::SetProp {
                node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                key: PropKey::from(key.as_str()),
                value: value.into(),
            },
            CommandDto::DeleteProp { node_id, key } => Command::DeleteProp {
                node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                key: PropKey::from(key.as_str()),
            },
            CommandDto::SetProps { node_id, props } => {
                let mut domain_props = Props::new();
                for (k, v) in props {
                    domain_props.insert(PropKey::from(k.as_str()), v.into());
                }
                Command::SetProps {
                    node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                    props: domain_props,
                }
            }
            CommandDto::SetViewOverride { node_id, view } => Command::SetViewOverride {
                node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                view: view.map(ViewDef::from),
            },
            CommandDto::SetKind { node_id, new_kind } => Command::SetKind {
                node_id: NodeId::from_uuid(uuid::Uuid::parse_str(&node_id).unwrap_or_default()),
                new_kind: Kind::from(new_kind),
            },
        }
    }
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum EventDto {
    NodeCreated {
        node: NodeDto,
        parent_id: Option<String>,
        index: usize,
    },
    NodeDeleted {
        nodes: Vec<NodeDto>,
        old_parent: Option<String>,
        old_index: usize,
    },
    NodeMoved {
        node_id: String,
        old_parent: Option<String>,
        old_index: usize,
        new_parent: Option<String>,
        new_index: usize,
    },
    PropSet {
        node_id: String,
        key: String,
        new_value: ValueDto,
        old_value: Option<ValueDto>,
    },
    PropDeleted {
        node_id: String,
        key: String,
        old_value: ValueDto,
    },
    PropsSet {
        node_id: String,
        changes: Vec<(String, ValueDto, Option<ValueDto>)>,
    },
    ViewOverrideSet {
        node_id: String,
        new_view: Option<ViewDefDto>,
        old_view: Option<ViewDefDto>,
    },
    KindSet {
        node_id: String,
        new_kind: String,
        old_kind: String,
    },
    Batch {
        events: Vec<EventDto>,
    },
}

impl From<&Event> for EventDto {
    fn from(event: &Event) -> Self {
        match event {
            Event::NodeCreated {
                node,
                parent_id,
                index,
            } => {
                let mut node_dto = NodeDto::from(node);
                node_dto.parent = parent_id.map(|id| id.to_string());
                EventDto::NodeCreated {
                    node: node_dto,
                    parent_id: parent_id.map(|id| id.to_string()),
                    index: *index,
                }
            }
            Event::NodeDeleted {
                nodes,
                old_parent,
                old_index,
            } => EventDto::NodeDeleted {
                nodes: nodes.iter().map(NodeDto::from).collect(),
                old_parent: old_parent.map(|id| id.to_string()),
                old_index: *old_index,
            },
            Event::NodeMoved {
                node_id,
                old_parent,
                old_index,
                new_parent,
                new_index,
            } => EventDto::NodeMoved {
                node_id: node_id.to_string(),
                old_parent: old_parent.map(|id| id.to_string()),
                old_index: *old_index,
                new_parent: new_parent.map(|id| id.to_string()),
                new_index: *new_index,
            },
            Event::PropSet {
                node_id,
                key,
                new_value,
                old_value,
            } => EventDto::PropSet {
                node_id: node_id.to_string(),
                key: key.as_str().to_string(),
                new_value: ValueDto::from(new_value),
                old_value: old_value.as_ref().map(ValueDto::from),
            },
            Event::PropDeleted {
                node_id,
                key,
                old_value,
            } => EventDto::PropDeleted {
                node_id: node_id.to_string(),
                key: key.as_str().to_string(),
                old_value: ValueDto::from(old_value),
            },
            Event::PropsSet { node_id, changes } => EventDto::PropsSet {
                node_id: node_id.to_string(),
                changes: changes
                    .iter()
                    .map(|(k, nv, ov)| {
                        (
                            k.as_str().to_string(),
                            ValueDto::from(nv),
                            ov.as_ref().map(ValueDto::from),
                        )
                    })
                    .collect(),
            },
            Event::ViewOverrideSet {
                node_id,
                new_view,
                old_view,
            } => EventDto::ViewOverrideSet {
                node_id: node_id.to_string(),
                new_view: new_view.as_ref().map(ViewDefDto::from),
                old_view: old_view.as_ref().map(ViewDefDto::from),
            },
            Event::KindSet {
                node_id,
                new_kind,
                old_kind,
            } => EventDto::KindSet {
                node_id: node_id.to_string(),
                new_kind: new_kind.as_str().to_string(),
                old_kind: old_kind.as_str().to_string(),
            },
            Event::Batch(events) => EventDto::Batch {
                events: events.iter().map(EventDto::from).collect(),
            },
        }
    }
}

impl From<&Command> for CommandDto {
    fn from(cmd: &Command) -> Self {
        match cmd {
            Command::CreateNode {
                id,
                kind,
                parent_id,
                index,
                props,
            } => {
                let mut dto_props = HashMap::new();
                for (k, v) in props.iter() {
                    dto_props.insert(k.as_str().to_string(), ValueDto::from(v));
                }
                CommandDto::CreateNode {
                    id: id.to_string(),
                    kind: kind.as_str().to_string(),
                    parent_id: parent_id.map(|id| id.to_string()),
                    index: *index,
                    props: dto_props,
                }
            }
            Command::DeleteNode { id, cascade } => CommandDto::DeleteNode {
                id: id.to_string(),
                cascade: *cascade,
            },
            Command::MoveNode {
                node_id,
                new_parent_id,
                new_index,
            } => CommandDto::MoveNode {
                node_id: node_id.to_string(),
                new_parent_id: new_parent_id.map(|id| id.to_string()),
                new_index: *new_index,
            },
            Command::SetProp {
                node_id,
                key,
                value,
            } => CommandDto::SetProp {
                node_id: node_id.to_string(),
                key: key.as_str().to_string(),
                value: ValueDto::from(value),
            },
            Command::DeleteProp { node_id, key } => CommandDto::DeleteProp {
                node_id: node_id.to_string(),
                key: key.as_str().to_string(),
            },
            Command::SetProps { node_id, props } => {
                let mut dto_props = HashMap::new();
                for (k, v) in props.iter() {
                    dto_props.insert(k.as_str().to_string(), ValueDto::from(v));
                }
                CommandDto::SetProps {
                    node_id: node_id.to_string(),
                    props: dto_props,
                }
            }
            Command::SetViewOverride { node_id, view } => CommandDto::SetViewOverride {
                node_id: node_id.to_string(),
                view: view.as_ref().map(ViewDefDto::from),
            },
            Command::SetKind { node_id, new_kind } => CommandDto::SetKind {
                node_id: node_id.to_string(),
                new_kind: new_kind.as_str().to_string(),
            },
        }
    }
}

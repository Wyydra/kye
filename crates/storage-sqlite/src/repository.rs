use chrono::{DateTime, Utc};
use rusqlite::{OptionalExtension, params};
use std::collections::HashMap;

use domain::command::Event;
use domain::graph::Graph;
use domain::ports::{GraphRepository, KindRepository, RepositoryError};
use domain::primitives::{Kind, NodeId};
use domain::schema::KindDef;
use domain::workspace::WorkspaceMeta;

use crate::connection::SqliteConnection;
use crate::dto::{BlockRow, KindRow, MetaRow};

#[derive(Clone)]
pub struct SqliteGraphRepository {
    conn: SqliteConnection,
}

impl SqliteGraphRepository {
    pub fn new(conn: SqliteConnection) -> Self {
        Self { conn }
    }
}

impl GraphRepository for SqliteGraphRepository {
    fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError> {
        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT id, name, default_remote, remotes_json FROM meta LIMIT 1")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let row = stmt
                .query_row([], |r| {
                    Ok(MetaRow {
                        id: r.get(0)?,
                        name: r.get(1)?,
                        default_remote: r.get(2)?,
                        remotes_json: r.get(3)?,
                    })
                })
                .optional()
                .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;

            match row {
                Some(r) => r.to_domain(),
                None => Err(RepositoryError::NotFound("meta".into())),
            }
        })
    }

    fn save_meta(&self, meta: &WorkspaceMeta) -> Result<(), RepositoryError> {
        let row = MetaRow::from_domain(meta);
        self.conn.with_conn(|conn| {
            conn.execute(
                "INSERT INTO meta (id, name, default_remote, remotes_json)
                 VALUES (?1, ?2, ?3, ?4)
                 ON CONFLICT(id) DO UPDATE SET
                    name = excluded.name,
                    default_remote = excluded.default_remote,
                    remotes_json = excluded.remotes_json",
                params![row.id, row.name, row.default_remote, row.remotes_json],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
            Ok(())
        })
    }

    fn load_graph(&self) -> Result<Graph, RepositoryError> {
        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT id, parent_id, kind, properties, content_ids, created_at, updated_at, view_override_json FROM blocks")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let block_rows = stmt
                .query_map([], |r| {
                    Ok(BlockRow {
                        id: r.get(0)?,
                        parent_id: r.get(1)?,
                        kind: r.get(2)?,
                        properties: r.get(3)?,
                        content_ids: r.get(4)?,
                        created_at: r.get(5)?,
                        updated_at: r.get(6)?,
                        view_override_json: r.get(7)?,
                    })
                })
                .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;

            let mut graph = Graph::new();
            let mut parents: HashMap<NodeId, NodeId> = HashMap::new();

            for row_res in block_rows {
                let row = row_res.map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                let node = row.to_domain()?;
                let node_id = node.id;

                if let Some(p_str) = &row.parent_id {
                    if let Ok(p_uuid) = uuid::Uuid::parse_str(p_str) {
                        parents.insert(node_id, NodeId::from_uuid(p_uuid));
                    }
                }

                let _ = graph.insert_root(node);
            }

            for (child, parent) in parents {
                if graph.get(parent).is_some() {
                    let _ = graph.move_node(child, Some(parent), usize::MAX);
                }
            }

            Ok(graph)
        })
    }

    fn apply_event(&self, event: &Event) -> Result<(), RepositoryError> {
        self.conn.with_conn_mut(|conn| {
            let tx = conn
                .transaction()
                .map_err(|e| RepositoryError::Io(format!("Failed to start transaction: {}", e)))?;

            apply_event_tx(&tx, event)?;

            tx.commit()
                .map_err(|e| RepositoryError::Io(format!("Failed to commit transaction: {}", e)))?;

            Ok(())
        })
    }

    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
        self.conn.with_conn_mut(|conn| {
            let tx = conn
                .transaction()
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            tx.execute("DELETE FROM blocks", [])
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            {
                let mut stmt = tx
                    .prepare(
                        "INSERT INTO blocks (id, parent_id, kind, properties, content_ids, created_at, updated_at, view_override_json)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
                    )
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                for node in graph.iter() {
                    let row = BlockRow::from_domain(node, graph);
                    stmt.execute(params![
                        row.id,
                        row.parent_id,
                        row.kind,
                        row.properties,
                        row.content_ids,
                        row.created_at,
                        row.updated_at,
                        row.view_override_json
                    ])
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                }
            }

            tx.commit()
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            Ok(())
        })
    }

    fn load_tombstones(&self) -> Result<HashMap<NodeId, DateTime<Utc>>, RepositoryError> {
        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT node_id, deleted_at FROM tombstones")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let rows = stmt
                .query_map([], |r| {
                    let id_str: String = r.get(0)?;
                    let del_str: String = r.get(1)?;
                    Ok((id_str, del_str))
                })
                .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;

            let mut map = HashMap::new();
            for r in rows {
                let (id_str, del_str) = r.map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                if let Ok(uuid) = uuid::Uuid::parse_str(&id_str) {
                    let dt = DateTime::parse_from_rfc3339(&del_str)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or_else(|_| Utc::now());
                    map.insert(NodeId::from_uuid(uuid), dt);
                }
            }
            Ok(map)
        })
    }
}

fn apply_event_tx(tx: &rusqlite::Transaction, event: &Event) -> Result<(), RepositoryError> {
    match event {
        Event::NodeCreated {
            node,
            parent_id,
            index: _,
        } => {
            let parent_id_str = parent_id.map(|id| id.to_string());
            let node_id_str = node.id.to_string();
            let kind_str = node.kind.as_str().to_string();
            let created_at_str = node.created_at.to_rfc3339();
            let updated_at_str = node.updated_at.to_rfc3339();

            let mut props_map: HashMap<String, crate::dto::ValueJson> = HashMap::new();
            for (k, v) in &node.props {
                props_map.insert(k.as_str().to_string(), crate::dto::ValueJson::from(v));
            }
            let properties = serde_json::to_string(&props_map).unwrap_or_else(|_| "{}".into());

            tx.execute(
                "INSERT INTO blocks (id, parent_id, kind, properties, content_ids, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, '[]', ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET
                    parent_id = excluded.parent_id,
                    kind = excluded.kind,
                    properties = excluded.properties,
                    updated_at = excluded.updated_at",
                params![node_id_str, parent_id_str, kind_str, properties, created_at_str, updated_at_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::NodeDeleted {
            nodes,
            old_parent: _,
            old_index: _,
        } => {
            let now_str = Utc::now().to_rfc3339();
            for n in nodes {
                let id_str = n.id.to_string();
                tx.execute("DELETE FROM blocks WHERE id = ?1", params![id_str])
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                tx.execute(
                    "INSERT INTO tombstones (node_id, deleted_at) VALUES (?1, ?2)
                     ON CONFLICT(node_id) DO UPDATE SET deleted_at = excluded.deleted_at",
                    params![id_str, now_str],
                )
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
            }
        }
        Event::NodeMoved {
            node_id,
            new_parent,
            new_index: _,
            old_parent: _,
            old_index: _,
        } => {
            let node_id_str = node_id.to_string();
            let parent_id_str = new_parent.map(|id| id.to_string());
            let now_str = Utc::now().to_rfc3339();

            tx.execute(
                "UPDATE blocks SET parent_id = ?1, updated_at = ?2 WHERE id = ?3",
                params![parent_id_str, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::PropSet {
            node_id,
            key,
            new_value,
            old_value: _,
        } => {
            let node_id_str = node_id.to_string();
            let now_str = Utc::now().to_rfc3339();

            let mut stmt = tx
                .prepare("SELECT properties FROM blocks WHERE id = ?1")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let current_props_json: Option<String> = stmt
                .query_row(params![node_id_str], |r| r.get(0))
                .optional()
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let mut props_map: HashMap<String, crate::dto::ValueJson> = current_props_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();

            props_map.insert(
                key.as_str().to_string(),
                crate::dto::ValueJson::from(new_value),
            );
            let new_props_json = serde_json::to_string(&props_map).unwrap_or_else(|_| "{}".into());

            tx.execute(
                "UPDATE blocks SET properties = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_props_json, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::PropDeleted {
            node_id,
            key,
            old_value: _,
        } => {
            let node_id_str = node_id.to_string();
            let now_str = Utc::now().to_rfc3339();

            let mut stmt = tx
                .prepare("SELECT properties FROM blocks WHERE id = ?1")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let current_props_json: Option<String> = stmt
                .query_row(params![node_id_str], |r| r.get(0))
                .optional()
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let mut props_map: HashMap<String, crate::dto::ValueJson> = current_props_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();

            props_map.remove(key.as_str());
            let new_props_json = serde_json::to_string(&props_map).unwrap_or_else(|_| "{}".into());

            tx.execute(
                "UPDATE blocks SET properties = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_props_json, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::PropsSet { node_id, changes } => {
            let node_id_str = node_id.to_string();
            let now_str = Utc::now().to_rfc3339();

            let mut stmt = tx
                .prepare("SELECT properties FROM blocks WHERE id = ?1")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let current_props_json: Option<String> = stmt
                .query_row(params![node_id_str], |r| r.get(0))
                .optional()
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let mut props_map: HashMap<String, crate::dto::ValueJson> = current_props_json
                .and_then(|s| serde_json::from_str(&s).ok())
                .unwrap_or_default();

            for (k, nv, _) in changes {
                props_map.insert(k.as_str().to_string(), crate::dto::ValueJson::from(nv));
            }
            let new_props_json = serde_json::to_string(&props_map).unwrap_or_else(|_| "{}".into());

            tx.execute(
                "UPDATE blocks SET properties = ?1, updated_at = ?2 WHERE id = ?3",
                params![new_props_json, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::ViewOverrideSet {
            node_id,
            new_view,
            old_view: _,
        } => {
            let node_id_str = node_id.to_string();
            let now_str = Utc::now().to_rfc3339();
            let vo_json = new_view
                .as_ref()
                .and_then(|v| serde_json::to_string(v).ok());

            tx.execute(
                "UPDATE blocks SET view_override_json = ?1, updated_at = ?2 WHERE id = ?3",
                params![vo_json, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::KindSet {
            node_id,
            new_kind,
            old_kind: _,
        } => {
            let node_id_str = node_id.to_string();
            let kind_str = new_kind.as_str().to_string();
            let now_str = Utc::now().to_rfc3339();

            tx.execute(
                "UPDATE blocks SET kind = ?1, updated_at = ?2 WHERE id = ?3",
                params![kind_str, now_str, node_id_str],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
        }
        Event::Batch(events) => {
            for e in events {
                apply_event_tx(tx, e)?;
            }
        }
    }

    Ok(())
}

impl KindRepository for SqliteGraphRepository {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError> {
        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT kind, label, icon, title_prop, definition_json FROM kinds")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let rows = stmt
                .query_map([], |r| {
                    Ok(KindRow {
                        kind: r.get(0)?,
                        label: r.get(1)?,
                        icon: r.get(2)?,
                        title_prop: r.get(3)?,
                        definition_json: r.get(4).unwrap_or_else(|_| "{}".into()),
                    })
                })
                .map_err(|e| RepositoryError::Corrupted(e.to_string()))?;

            let mut result = Vec::new();
            for r in rows {
                let row = r.map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                result.push(row.to_domain());
            }

            Ok(result)
        })
    }

    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError> {
        let row = KindRow::from_domain(kind, def);
        self.conn.with_conn(|conn| {
            conn.execute(
                "INSERT INTO kinds (kind, label, icon, title_prop, definition_json)
                 VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(kind) DO UPDATE SET
                    label = excluded.label,
                    icon = excluded.icon,
                    title_prop = excluded.title_prop,
                    definition_json = excluded.definition_json",
                params![row.kind, row.label, row.icon, row.title_prop, row.definition_json],
            )
            .map_err(|e| RepositoryError::Io(e.to_string()))?;
            Ok(())
        })
    }

    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError> {
        self.conn.with_conn(|conn| {
            conn.execute("DELETE FROM kinds WHERE kind = ?1", params![kind.as_str()])
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
            Ok(())
        })
    }
}

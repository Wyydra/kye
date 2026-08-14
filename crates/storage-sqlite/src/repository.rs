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
                .prepare("SELECT id, parent_id, kind, properties, content_ids, created_at, updated_at, view_override_json FROM blocks ORDER BY rowid ASC")
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
            let mut parent_to_children_order: Vec<(NodeId, Vec<NodeId>)> = Vec::new();
            let mut fallback_parents: Vec<(NodeId, NodeId)> = Vec::new();

            for row_res in block_rows {
                let row = row_res.map_err(|e| RepositoryError::Corrupted(e.to_string()))?;
                let node = row.to_domain()?;
                let node_id = node.id;

                let parsed_children: Vec<NodeId> = serde_json::from_str::<Vec<String>>(&row.content_ids)
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|s| uuid::Uuid::parse_str(&s).ok().map(NodeId::from_uuid))
                    .collect();

                if !parsed_children.is_empty() {
                    parent_to_children_order.push((node_id, parsed_children));
                }

                if let Some(p_str) = &row.parent_id
                    && let Ok(p_uuid) = uuid::Uuid::parse_str(p_str)
                {
                    fallback_parents.push((node_id, NodeId::from_uuid(p_uuid)));
                }

                let _ = graph.insert_root(node);
            }

            // 1. First reconstruct children using the exact ordered content_ids
            let mut moved_children = std::collections::HashSet::new();
            for (parent_id, children_ids) in parent_to_children_order {
                for (index, child_id) in children_ids.into_iter().enumerate() {
                    if graph.get(child_id).is_some() && graph.get(parent_id).is_some() {
                        let _ = graph.move_node(child_id, Some(parent_id), index);
                        moved_children.insert(child_id);
                    }
                }
            }

            // 2. For any child with parent_id not listed in content_ids, attach as fallback
            for (child, parent) in fallback_parents {
                if !moved_children.contains(&child) && graph.get(parent).is_some() {
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

    fn flush(&self) -> Result<(), RepositoryError> {
        self.conn.checkpoint_truncate()
    }
}

fn apply_event_tx(tx: &rusqlite::Transaction, event: &Event) -> Result<(), RepositoryError> {
    match event {
        Event::NodeCreated {
            node,
            parent_id,
            index,
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

            if let Some(pid) = parent_id {
                let pid_str = pid.to_string();
                let mut stmt = tx
                    .prepare("SELECT content_ids FROM blocks WHERE id = ?1")
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                let content_ids_raw: Option<String> = stmt
                    .query_row(params![pid_str], |r| r.get(0))
                    .optional()
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                let mut children: Vec<String> = content_ids_raw
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();

                let insert_idx = (*index).min(children.len());
                children.insert(insert_idx, node_id_str);
                let new_content_ids = serde_json::to_string(&children).unwrap_or_else(|_| "[]".into());

                tx.execute(
                    "UPDATE blocks SET content_ids = ?1 WHERE id = ?2",
                    params![new_content_ids, pid_str],
                )
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
            }
        }
        Event::NodeDeleted {
            nodes,
            old_parent,
            old_index: _,
        } => {
            let now_str = Utc::now().to_rfc3339();
            let deleted_ids_set: std::collections::HashSet<String> =
                nodes.iter().map(|n| n.id.to_string()).collect();

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

            if let Some(old_pid) = old_parent {
                let old_pid_str = old_pid.to_string();
                let mut stmt = tx
                    .prepare("SELECT content_ids FROM blocks WHERE id = ?1")
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                let content_ids_raw: Option<String> = stmt
                    .query_row(params![old_pid_str], |r| r.get(0))
                    .optional()
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                if let Some(raw) = content_ids_raw {
                    let mut children: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
                    children.retain(|id| !deleted_ids_set.contains(id));
                    let new_content_ids =
                        serde_json::to_string(&children).unwrap_or_else(|_| "[]".into());

                    tx.execute(
                        "UPDATE blocks SET content_ids = ?1 WHERE id = ?2",
                        params![new_content_ids, old_pid_str],
                    )
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                }
            }
        }
        Event::NodeMoved {
            node_id,
            new_parent,
            new_index,
            old_parent,
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

            // 1. Remove from old parent content_ids
            if let Some(old_pid) = old_parent {
                let old_pid_str = old_pid.to_string();
                let mut stmt = tx
                    .prepare("SELECT content_ids FROM blocks WHERE id = ?1")
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                let content_ids_raw: Option<String> = stmt
                    .query_row(params![old_pid_str], |r| r.get(0))
                    .optional()
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                if let Some(raw) = content_ids_raw {
                    let mut children: Vec<String> = serde_json::from_str(&raw).unwrap_or_default();
                    children.retain(|id| id != &node_id_str);
                    let new_content_ids =
                        serde_json::to_string(&children).unwrap_or_else(|_| "[]".into());

                    tx.execute(
                        "UPDATE blocks SET content_ids = ?1 WHERE id = ?2",
                        params![new_content_ids, old_pid_str],
                    )
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                }
            }

            // 2. Insert into new parent content_ids
            if let Some(new_pid) = new_parent {
                let new_pid_str = new_pid.to_string();
                let mut stmt = tx
                    .prepare("SELECT content_ids FROM blocks WHERE id = ?1")
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;
                let content_ids_raw: Option<String> = stmt
                    .query_row(params![new_pid_str], |r| r.get(0))
                    .optional()
                    .map_err(|e| RepositoryError::Io(e.to_string()))?;

                let mut children: Vec<String> = content_ids_raw
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or_default();

                children.retain(|id| id != &node_id_str);
                let target_idx = (*new_index).min(children.len());
                children.insert(target_idx, node_id_str);
                let new_content_ids =
                    serde_json::to_string(&children).unwrap_or_else(|_| "[]".into());

                tx.execute(
                    "UPDATE blocks SET content_ids = ?1 WHERE id = ?2",
                    params![new_content_ids, new_pid_str],
                )
                .map_err(|e| RepositoryError::Io(e.to_string()))?;
            }
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

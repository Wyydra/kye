use crate::connection::SqliteConnection;
use domain::ports::RepositoryError;
use domain::primitives::NodeId;
use rusqlite::params;

pub struct FtsEngine {
    conn: SqliteConnection,
}

impl FtsEngine {
    pub fn new(conn: SqliteConnection) -> Self {
        Self { conn }
    }

    pub fn search(&self, query: &str) -> Result<Vec<NodeId>, RepositoryError> {
        if query.trim().is_empty() {
            return Ok(Vec::new());
        }

        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT block_id FROM blocks_fts WHERE blocks_fts MATCH ?1")
                .map_err(|e| RepositoryError::Io(format!("FTS query error: {}", e)))?;

            let rows = stmt
                .query_map(params![query], |r| {
                    let id_str: String = r.get(0)?;
                    Ok(id_str)
                })
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let mut node_ids = Vec::new();
            for id_str in rows.flatten() {
                if let Ok(uuid) = uuid::Uuid::parse_str(&id_str) {
                    node_ids.push(NodeId::from_uuid(uuid));
                }
            }

            Ok(node_ids)
        })
    }
}

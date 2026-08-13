use rusqlite::Connection;
use std::path::Path;
use std::sync::{Arc, Mutex};

use crate::schema::init_schema;
use domain::ports::RepositoryError;

#[derive(Clone)]
pub struct SqliteConnection {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteConnection {
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        let path = db_path.as_ref();
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                let _ = std::fs::create_dir_all(parent);
            }
        }

        let conn = Connection::open(path)
            .map_err(|e| RepositoryError::Io(format!("Failed to open SQLite db: {}", e)))?;

        // Enable PRAGMAs for maximum performance & integrity
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;",
        )
        .map_err(|e| RepositoryError::Io(format!("Failed to set PRAGMAs: {}", e)))?;

        init_schema(&conn)?;

        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn with_conn<F, R>(&self, f: F) -> Result<R, RepositoryError>
    where
        F: FnOnce(&Connection) -> Result<R, RepositoryError>,
    {
        let conn = self
            .conn
            .lock()
            .map_err(|_| RepositoryError::Corrupted("SQLite lock poisoned".into()))?;
        f(&conn)
    }

    pub fn with_conn_mut<F, R>(&self, f: F) -> Result<R, RepositoryError>
    where
        F: FnOnce(&mut Connection) -> Result<R, RepositoryError>,
    {
        let mut conn = self
            .conn
            .lock()
            .map_err(|_| RepositoryError::Corrupted("SQLite lock poisoned".into()))?;
        f(&mut conn)
    }
}

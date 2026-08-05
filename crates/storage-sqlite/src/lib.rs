pub mod connection;
pub mod dto;
pub mod fts;
pub mod repository;
pub mod schema;
pub mod sqlar;

pub use connection::SqliteConnection;
pub use fts::FtsEngine;
pub use repository::SqliteGraphRepository;
pub use sqlar::SqlarAssetRepository;

use std::path::Path;
use domain::ports::RepositoryError;

impl SqliteGraphRepository {
    pub fn open(db_path: impl AsRef<Path>) -> Result<Self, RepositoryError> {
        let conn = SqliteConnection::open(db_path)?;
        Ok(Self::new(conn))
    }
}

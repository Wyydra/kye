use chrono::{DateTime, Utc};
use std::collections::HashMap;

use domain::command::Event;
use domain::graph::Graph;
use domain::ports::{AssetRepository, GraphRepository, KindRepository, RepositoryError};
use domain::primitives::{Kind, NodeId};
use domain::schema::KindDef;
use domain::workspace::WorkspaceMeta;
use storage_fs::{FileAssetRepository, FileKindRepository, FsGraphRepository};
use storage_sqlite::{SqlarAssetRepository, SqliteGraphRepository};

#[derive(Clone)]
pub enum DynamicGraphRepository {
    Fs(FsGraphRepository),
    Sqlite(SqliteGraphRepository),
}

impl GraphRepository for DynamicGraphRepository {
    fn load_meta(&self) -> Result<WorkspaceMeta, RepositoryError> {
        match self {
            Self::Fs(r) => r.load_meta(),
            Self::Sqlite(r) => r.load_meta(),
        }
    }

    fn save_meta(&self, meta: &WorkspaceMeta) -> Result<(), RepositoryError> {
        match self {
            Self::Fs(r) => r.save_meta(meta),
            Self::Sqlite(r) => r.save_meta(meta),
        }
    }

    fn load_graph(&self) -> Result<Graph, RepositoryError> {
        match self {
            Self::Fs(r) => r.load_graph(),
            Self::Sqlite(r) => r.load_graph(),
        }
    }

    fn apply_event(&self, event: &Event) -> Result<(), RepositoryError> {
        match self {
            Self::Fs(r) => r.apply_event(event),
            Self::Sqlite(r) => r.apply_event(event),
        }
    }

    fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
        match self {
            Self::Fs(r) => r.save_all(graph),
            Self::Sqlite(r) => r.save_all(graph),
        }
    }

    fn load_tombstones(&self) -> Result<HashMap<NodeId, DateTime<Utc>>, RepositoryError> {
        match self {
            Self::Fs(r) => r.load_tombstones(),
            Self::Sqlite(r) => r.load_tombstones(),
        }
    }
}

#[derive(Clone)]
pub enum DynamicKindRepository {
    Fs(FileKindRepository),
    Sqlite(SqliteGraphRepository),
}

impl KindRepository for DynamicKindRepository {
    fn load_kinds(&self) -> Result<Vec<(Kind, KindDef)>, RepositoryError> {
        match self {
            Self::Fs(r) => r.load_kinds(),
            Self::Sqlite(r) => r.load_kinds(),
        }
    }

    fn save_kind(&self, kind: &Kind, def: &KindDef) -> Result<(), RepositoryError> {
        match self {
            Self::Fs(r) => r.save_kind(kind, def),
            Self::Sqlite(r) => r.save_kind(kind, def),
        }
    }

    fn delete_kind(&self, kind: &Kind) -> Result<(), RepositoryError> {
        match self {
            Self::Fs(r) => r.delete_kind(kind),
            Self::Sqlite(r) => r.delete_kind(kind),
        }
    }
}

#[derive(Clone)]
pub enum DynamicAssetRepository {
    Fs(FileAssetRepository),
    Sqlite(SqlarAssetRepository),
}

impl AssetRepository for DynamicAssetRepository {
    fn save_asset(&self, filename: &str, data: &[u8]) -> Result<String, RepositoryError> {
        match self {
            Self::Fs(r) => r.save_asset(filename, data),
            Self::Sqlite(r) => r.save_asset(filename, data),
        }
    }

    fn read_asset(&self, target: &str) -> Result<Vec<u8>, RepositoryError> {
        match self {
            Self::Fs(r) => r.read_asset(target),
            Self::Sqlite(r) => r.read_asset(target),
        }
    }
}

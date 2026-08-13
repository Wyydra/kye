use flate2::Compression;
use flate2::read::ZlibDecoder;
use flate2::write::ZlibEncoder;
use rusqlite::params;
use std::io::{Read, Write};
use std::path::Path;
use uuid::Uuid;

use domain::ports::{AssetRepository, RepositoryError};

use crate::connection::SqliteConnection;

#[derive(Clone)]
pub struct SqlarAssetRepository {
    conn: SqliteConnection,
}

impl SqlarAssetRepository {
    pub fn new(conn: SqliteConnection) -> Self {
        Self { conn }
    }
}

impl AssetRepository for SqlarAssetRepository {
    fn save_asset(&self, filename: &str, raw_bytes: &[u8]) -> Result<String, RepositoryError> {
        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase();

        let mtime = chrono::Utc::now().timestamp();
        let uncompressed_sz = raw_bytes.len();
        let asset_id = Uuid::new_v4().to_string();
        let target_filename = format!("{}_{}", &asset_id[..8], filename);

        // Compress text/svg/json with Zlib if beneficial
        let (store_bytes, _is_compressed) =
            if ext == "svg" || ext == "json" || ext == "txt" || ext == "md" {
                let mut encoder = ZlibEncoder::new(Vec::new(), Compression::fast());
                if encoder.write_all(raw_bytes).is_ok() && encoder.flush().is_ok() {
                    if let Ok(compressed) = encoder.finish() {
                        if compressed.len() < uncompressed_sz {
                            (compressed, true)
                        } else {
                            (raw_bytes.to_vec(), false)
                        }
                    } else {
                        (raw_bytes.to_vec(), false)
                    }
                } else {
                    (raw_bytes.to_vec(), false)
                }
            } else {
                (raw_bytes.to_vec(), false)
            };

        let mode: i64 = 33188; // 0644

        self.conn.with_conn(|conn| {
            conn.execute(
                "INSERT INTO sqlar (name, mode, mtime, sz, data) VALUES (?1, ?2, ?3, ?4, ?5)
                 ON CONFLICT(name) DO UPDATE SET mode=excluded.mode, mtime=excluded.mtime, sz=excluded.sz, data=excluded.data",
                params![target_filename, mode, mtime, uncompressed_sz as i64, store_bytes],
            )
            .map_err(|e| RepositoryError::Io(format!("Failed to insert into sqlar: {}", e)))?;
            Ok(())
        })?;

        Ok(format!("sqlar://{}", target_filename))
    }

    fn read_asset(&self, target: &str) -> Result<Vec<u8>, RepositoryError> {
        let asset_name = target.strip_prefix("sqlar://").unwrap_or(target);
        self.conn.with_conn(|conn| {
            let mut stmt = conn
                .prepare("SELECT sz, data FROM sqlar WHERE name = ?1")
                .map_err(|e| RepositoryError::Io(e.to_string()))?;

            let row = stmt
                .query_row(params![asset_name], |r| {
                    let sz: i64 = r.get(0)?;
                    let data: Vec<u8> = r.get(1)?;
                    Ok((sz as usize, data))
                })
                .map_err(|e| {
                    RepositoryError::NotFound(format!("Asset '{}' not found: {}", asset_name, e))
                })?;

            let (original_sz, data) = row;
            if data.len() == original_sz {
                Ok(data)
            } else {
                let mut decoder = ZlibDecoder::new(&data[..]);
                let mut decompressed = Vec::with_capacity(original_sz);
                decoder.read_to_end(&mut decompressed).map_err(|e| {
                    RepositoryError::Corrupted(format!("Decompression failed: {}", e))
                })?;
                Ok(decompressed)
            }
        })
    }
}

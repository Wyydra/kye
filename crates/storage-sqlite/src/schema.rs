use domain::ports::RepositoryError;
use rusqlite::Connection;

pub fn init_schema(conn: &Connection) -> Result<(), RepositoryError> {
    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS meta (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            default_remote TEXT,
            remotes_json TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS blocks (
            id TEXT PRIMARY KEY,
            parent_id TEXT,
            kind TEXT NOT NULL,
            properties TEXT NOT NULL DEFAULT '{}',
            content_ids TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            view_override_json TEXT,
            FOREIGN KEY (parent_id) REFERENCES blocks(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_blocks_parent ON blocks(parent_id);
        CREATE INDEX IF NOT EXISTS idx_blocks_kind ON blocks(kind);

        CREATE TABLE IF NOT EXISTS tombstones (
            node_id TEXT PRIMARY KEY,
            deleted_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS kinds (
            kind TEXT PRIMARY KEY,
            label TEXT NOT NULL,
            icon TEXT,
            title_prop TEXT NOT NULL,
            definition_json TEXT NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS sqlar (
            name TEXT PRIMARY KEY,
            mode INT NOT NULL,
            mtime INT NOT NULL,
            sz INT NOT NULL,
            data BLOB
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS blocks_fts USING fts5(
            block_id,
            plain_text_content
        );

        CREATE TRIGGER IF NOT EXISTS blocks_after_insert AFTER INSERT ON blocks BEGIN
            INSERT INTO blocks_fts(block_id, plain_text_content)
            VALUES (new.id, COALESCE(json_extract(new.properties, '$.title.v'), json_extract(new.properties, '$.title'), json_extract(new.properties, '$.body.v'), json_extract(new.properties, '$.body')));
        END;

        CREATE TRIGGER IF NOT EXISTS blocks_after_update AFTER UPDATE ON blocks BEGIN
            DELETE FROM blocks_fts WHERE block_id = old.id;
            INSERT INTO blocks_fts(block_id, plain_text_content)
            VALUES (new.id, COALESCE(json_extract(new.properties, '$.title.v'), json_extract(new.properties, '$.title'), json_extract(new.properties, '$.body.v'), json_extract(new.properties, '$.body')));
        END;

        CREATE TRIGGER IF NOT EXISTS blocks_after_delete AFTER DELETE ON blocks BEGIN
            DELETE FROM blocks_fts WHERE block_id = old.id;
        END;
        ",
    )
    .map_err(|e| RepositoryError::Io(format!("Failed to initialize schema: {}", e)))?;

    // Migration for existing kinds table missing definition_json column
    let _ = conn.execute(
        "ALTER TABLE kinds ADD COLUMN definition_json TEXT NOT NULL DEFAULT '{}'",
        [],
    );

    Ok(())
}

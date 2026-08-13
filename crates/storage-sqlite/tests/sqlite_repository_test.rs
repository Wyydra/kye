use chrono::Utc;
use std::path::PathBuf;

use domain::command::Event;
use domain::node::NodeBuilder;
use domain::ports::{AssetRepository, GraphRepository, KindRepository};
use domain::primitives::{Kind, NodeId, PropKey};
use domain::schema::KindDef;
use domain::value::Value;
use domain::workspace::WorkspaceMeta;
use storage_sqlite::{FtsEngine, SqlarAssetRepository, SqliteConnection, SqliteGraphRepository};

fn temp_db_path() -> PathBuf {
    let dir = std::env::temp_dir();
    let name = format!("kye_test_{}.db", uuid::Uuid::new_v4());
    dir.join(name)
}

#[test]
fn test_sqlite_workspace_meta_roundtrip() {
    let db_path = temp_db_path();
    let repo = SqliteGraphRepository::open(&db_path).expect("Failed to open db");

    let meta = WorkspaceMeta::new(uuid::Uuid::new_v4(), "Test Workspace");
    repo.save_meta(&meta).expect("Failed to save meta");

    let loaded = repo.load_meta().expect("Failed to load meta");
    assert_eq!(loaded.id, meta.id);
    assert_eq!(loaded.name, "Test Workspace");

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn test_sqlite_graph_events_and_tombstones() {
    let db_path = temp_db_path();
    let repo = SqliteGraphRepository::open(&db_path).expect("Failed to open db");

    let page_id = NodeId::new();
    let page_node = NodeBuilder::new("core.page", Utc::now())
        .with_id(page_id)
        .with_prop("title", Value::Text("Ma Page Test".into()))
        .build();

    // 1. Apply NodeCreated
    let event = Event::NodeCreated {
        node: page_node.clone(),
        parent_id: None,
        index: 0,
    };
    repo.apply_event(&event).expect("Failed to apply event");

    let graph = repo.load_graph().expect("Failed to load graph");
    assert_eq!(graph.len(), 1);
    assert!(graph.contains(page_id));
    assert_eq!(graph.get(page_id).unwrap().title(), Some("Ma Page Test"));

    // 2. Apply PropSet
    let update_event = Event::PropSet {
        node_id: page_id,
        key: PropKey::from("title"),
        new_value: Value::Text("Titre Modifié".into()),
        old_value: None,
    };
    repo.apply_event(&update_event)
        .expect("Failed to apply prop set");

    let updated_graph = repo.load_graph().expect("Failed to load updated graph");
    assert_eq!(
        updated_graph.get(page_id).unwrap().title(),
        Some("Titre Modifié")
    );

    // 3. Apply NodeDeleted
    let delete_event = Event::NodeDeleted {
        nodes: vec![page_node],
        old_parent: None,
        old_index: 0,
    };
    repo.apply_event(&delete_event)
        .expect("Failed to delete node");

    let empty_graph = repo
        .load_graph()
        .expect("Failed to load graph after delete");
    assert_eq!(empty_graph.len(), 0);

    let tombstones = repo.load_tombstones().expect("Failed to load tombstones");
    assert!(tombstones.contains_key(&page_id));

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn test_sqlite_kind_repository() {
    use domain::schema::{Constraint, PropDef, ValueType};
    use domain::view::{DocumentLayout, Surface, ViewDef};

    let db_path = temp_db_path();
    let repo = SqliteGraphRepository::open(&db_path).expect("Failed to open db");

    let kind = Kind::from("user.project");
    let def = KindDef::new("Project", "title")
        .with_icon("🚀")
        .with_prop("title", PropDef::new(ValueType::Text).with_label("Project Title"))
        .with_prop("deadline", PropDef::new(ValueType::Date).optional().with_label("Deadline"))
        .with_prop("status", PropDef::new(ValueType::OneOf(vec!["todo".into(), "doing".into(), "done".into()])).with_label("Status"))
        .with_view(ViewDef::new(Surface::Document { layout: DocumentLayout::VerticalStream }))
        .with_constraint(Constraint::AllowedChildKinds(vec![Kind::from("core.task"), Kind::from("core.page")]));

    repo.save_kind(&kind, &def).expect("Failed to save kind");

    let kinds = repo.load_kinds().expect("Failed to load kinds");
    assert_eq!(kinds.len(), 1);
    assert_eq!(kinds[0].0, kind);
    assert_eq!(kinds[0].1.label, "Project");
    assert_eq!(kinds[0].1.icon.as_deref(), Some("🚀"));
    assert_eq!(kinds[0].1.title_prop.as_str(), "title");
    assert_eq!(kinds[0].1.props.len(), 3);
    assert!(kinds[0].1.prop(&domain::primitives::PropKey::from("deadline")).unwrap().label.as_deref() == Some("Deadline"));
    assert_eq!(kinds[0].1.constraints.len(), 1);

    repo.delete_kind(&kind).expect("Failed to delete kind");
    let empty_kinds = repo
        .load_kinds()
        .expect("Failed to load kinds after delete");
    assert_eq!(empty_kinds.len(), 0);

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn test_sqlar_asset_repository_import_and_decompress() {
    let db_path = temp_db_path();
    let conn = SqliteConnection::open(&db_path).expect("Failed to open db connection");
    let asset_repo = SqlarAssetRepository::new(conn);

    let sample_text = "Contenu textuel binaire pour le test d'archivage sqlar ".repeat(20);
    let sample_bytes = sample_text.as_bytes();

    let target_url = asset_repo
        .save_asset("test_asset.txt", sample_bytes)
        .expect("Failed to save asset into sqlar");

    assert!(target_url.starts_with("sqlar://"));

    let read_bytes = asset_repo
        .read_asset(&target_url)
        .expect("Failed to read asset bytes from sqlar");

    let read_text = String::from_utf8(read_bytes).expect("Invalid utf-8 string");
    assert_eq!(read_text, sample_text);

    let _ = std::fs::remove_file(db_path);
}

#[test]
fn test_fts5_full_text_search() {
    let db_path = temp_db_path();
    let conn = SqliteConnection::open(&db_path).expect("Failed to open db connection");
    let repo = SqliteGraphRepository::new(conn.clone());
    let fts = FtsEngine::new(conn);

    let node_id = NodeId::new();
    let node = NodeBuilder::new("core.page", Utc::now())
        .with_id(node_id)
        .with_prop("title", Value::Text("Recherche Spéciale Notion".into()))
        .build();

    let event = Event::NodeCreated {
        node,
        parent_id: None,
        index: 0,
    };
    repo.apply_event(&event).expect("Failed to apply event");

    let search_results = fts.search("Notion").expect("FTS search failed");
    assert_eq!(search_results.len(), 1);
    assert_eq!(search_results[0], node_id);

    let _ = std::fs::remove_file(db_path);
}

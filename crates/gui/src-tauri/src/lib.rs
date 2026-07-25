pub mod commands;
pub mod dto;
pub mod error;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use infra::fs::WorkspaceFs;
use infra::graph::InMemoryGraphRepository;
use infra::kind::FileKindRepository;
use infra::media::FileAssetRepository;

use crate::state::{AppState, TauriEventBus};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            let settings_path = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join("settings.json");
            let store_rc = StoreBuilder::new(app, settings_path).build();

            let workspace_path = match &store_rc {
                Ok(store) => {
                    let _ = store.reload();
                    if let Some(path_val) = store.get("workspace_path") {
                        if let Some(s) = path_val.as_str() {
                            let p = PathBuf::from(s);
                            if p.exists() { Some(p) } else { None }
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
                Err(e) => {
                    tracing::error!("Store error: {:?}", e);
                    None
                }
            };

            let app_handle = app.handle().clone();

            let service = if let Some(path) = &workspace_path {
                let fs = WorkspaceFs::new(path.clone());
                if let Err(e) = fs.init() {
                    tracing::error!("Failed to init WorkspaceFs: {:?}", e);
                    None
                } else {
                    let _ = InMemoryGraphRepository::load(fs.clone());

                    let graph_repo = match InMemoryGraphRepository::load(fs.clone()) {
                        Ok(repo) => repo,
                        Err(e) => {
                            tracing::error!("Failed to load graph repository: {:?}", e);

                            return Err(e.to_string().into());
                        }
                    };

                    let kind_repo = FileKindRepository::new(fs.clone());
                    let asset_repo = FileAssetRepository::new(fs);
                    let event_bus = TauriEventBus {
                        app_handle: app_handle.clone(),
                    };

                    Some(Arc::new(Service::new(
                        graph_repo, kind_repo, event_bus, asset_repo,
                    )))
                }
            } else {
                None
            };

            let app_state = AppState::new(service, workspace_path);
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace::get_workspace_path,
            commands::workspace::get_meta,
            commands::workspace::get_graph,
            commands::workspace::select_workspace_folder,
            commands::node::execute_command,
            commands::node::execute_batch,
            commands::kind::get_kinds,
            commands::kind::register_kind,
            commands::kind::delete_kind,
            commands::media::import_media,
            commands::media::import_asset,
            commands::media::open_asset,
            commands::media::reveal_asset,
            commands::workspace::list_workspaces,
            commands::workspace::create_workspace,
            commands::sync::get_local_peer_info,
            commands::sync::generate_pairing_qr,
            commands::sync::start_p2p_server,
            commands::sync::stop_p2p_server,
            commands::sync::is_p2p_server_running,
            commands::sync::ping_remote_peer,
            commands::sync::push_to_remote_peer,
            commands::sync::add_remote,
            commands::sync::remove_remote,
            commands::sync::list_remotes,
            commands::sync::compute_sync_diff,
            commands::sync::sync_with_remote_peer,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}

pub fn run_headless(workspace_path: PathBuf, port: u16) -> Result<(), String> {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .try_init();

    if !workspace_path.exists() {
        return Err(format!(
            "Workspace path '{}' does not exist.",
            workspace_path.display()
        ));
    }

    let fs = WorkspaceFs::new(workspace_path.clone());
    fs.init()
        .map_err(|e| format!("Failed to initialize workspace: {:?}", e))?;

    let graph_repo = InMemoryGraphRepository::load(fs.clone())
        .map_err(|e| format!("Failed to load graph repository: {:?}", e))?;

    use domain::ports::GraphRepository;
    let meta = graph_repo
        .load_meta()
        .map_err(|e| format!("Failed to load workspace metadata: {:?}", e))?;

    let peer_id = meta.id.to_string();
    let device_name = meta.name.clone();

    tracing::info!(
        "Starting Kye headless server for workspace: {}",
        device_name
    );
    tracing::info!("Workspace ID: {}", peer_id);
    tracing::info!("Workspace Path: {}", workspace_path.display());

    let kind_repo = FileKindRepository::new(fs.clone());
    let asset_repo = FileAssetRepository::new(fs);

    let service = Arc::new(Service::new(graph_repo, kind_repo, (), asset_repo));

    let _server = infra::sync::P2pServer::start(service, peer_id, device_name, port)
        .map_err(|e| format!("Failed to start sync server: {}", e))?;

    tracing::info!("Kye headless server is running on port {}", port);
    tracing::info!("Press Ctrl+C to stop.");

    loop {
        std::thread::sleep(std::time::Duration::from_secs(3600));
    }
}

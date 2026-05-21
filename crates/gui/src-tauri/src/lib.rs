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
use infra::media::FileMediaRepository;

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
            let settings_path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from(".")).join("settings.json");
            let store_rc = StoreBuilder::new(app, settings_path).build();

            let workspace_path = match &store_rc {
                Ok(store) => {
                    let _ = store.reload();
                    if let Some(path_val) = store.get("workspace_path") {
                        if let Some(s) = path_val.as_str() {
                            let p = PathBuf::from(s);
                            if p.exists() {
                                Some(p)
                            } else {
                                None
                            }
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
                    let media_repo = FileMediaRepository::new(fs);
                    let event_bus = TauriEventBus { app_handle: app_handle.clone() };

                    Some(Arc::new(Service::new(graph_repo, kind_repo, event_bus, media_repo)))
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
            commands::workspace::list_workspaces,
            commands::workspace::create_workspace,
            commands::sync::get_local_peer_info,
            commands::sync::generate_pairing_qr,
            commands::sync::start_p2p_server,
            commands::sync::stop_p2p_server,
            commands::sync::is_p2p_server_running,
            commands::sync::ping_remote_peer,
            commands::sync::push_to_remote_peer,
            commands::sync::pull_remote_peer_graph,
            commands::sync::get_local_tombstones,
            commands::sync::pull_remote_peer_tombstones,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}

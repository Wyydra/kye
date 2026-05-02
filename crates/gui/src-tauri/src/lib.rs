pub mod commands;
pub mod dto;
pub mod error;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;
use infra::watcher::FSWatcher;

use crate::state::{AppState, TauriEventDispatcher};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
            
            let (service, watcher) = if let Some(path) = &workspace_path {
                let dispatcher = TauriEventDispatcher { app_handle: app_handle.clone() };
                let repo = DirectoryWorkspaceRepository::new(path.clone());
                let srv = Arc::new(Service::new(repo, dispatcher));
                let w = FSWatcher::new(path.clone(), (*srv).clone());
                (Some(srv), Some(w))
            } else {
                (None, None)
            };

            let app_state = AppState::new(service, workspace_path, watcher);
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_workspace,
            commands::create_block,
            commands::update_block,
            commands::delete_block,
            commands::get_workspace_path,
            commands::get_block_types,
            commands::get_templates,
            commands::identify_block_shapes,
            commands::select_workspace_folder
        ])
        .run(tauri::generate_context!())
        .expect("Tauri Error");
}

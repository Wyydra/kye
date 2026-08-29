pub mod backend;
pub mod commands;
pub mod dto;
pub mod error;
pub mod state;

use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_store::StoreBuilder;

use domain::service::Service;
use shell_desktop::DesktopSystemShell;
use storage_fs::{FileAssetRepository, FileKindRepository, FsGraphRepository, WorkspaceFs};
use sync_http::HttpSyncServer;

use crate::commands::workspace::open_workspace_service;
use crate::state::AppState;

use tracing_subscriber::EnvFilter;
use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;

struct LogTimeFormat;

impl FormatTime for LogTimeFormat {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        let now = chrono::Local::now();
        write!(w, "{}", now.format("%H:%M:%S%.3f"))
    }
}

pub fn init_logging() {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,kye_lib=info,domain=info"));

    let _ = tracing_subscriber::fmt()
        .compact()
        .with_timer(LogTimeFormat)
        .with_target(false)
        .with_env_filter(filter)
        .try_init();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_logging();

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

            let raw_workspace_uri = match &store_rc {
                Ok(store) => {
                    let _ = store.reload();
                    store
                        .get("workspace_path")
                        .and_then(|v| v.as_str().map(|s| s.to_string()))
                }
                Err(e) => {
                    tracing::error!("Store error: {:?}", e);
                    None
                }
            };

            let app_handle = app.handle().clone();

            let (service, resolved_path) = match raw_workspace_uri {
                Some(uri) => {
                    let clean_uri = uri
                        .strip_prefix("sqlite://")
                        .or_else(|| uri.strip_prefix("file://"))
                        .or_else(|| uri.strip_prefix("fs://"))
                        .unwrap_or(&uri);
                    let p = PathBuf::from(clean_uri);
                    let actual_file = if p.is_dir() || p.extension().is_none() {
                        p.join("workspace.kye")
                    } else {
                        p
                    };

                    if actual_file.exists() {
                        match open_workspace_service(&uri, app_handle.clone()) {
                            Ok((svc, p)) => {
                                let meta_name = svc.get_meta().map(|m| m.name).ok();
                                let _ = crate::commands::workspace::record_workspace_opened(
                                    &app_handle,
                                    &p,
                                    meta_name.as_deref(),
                                );
                                (Some(svc), Some(p))
                            }
                            Err(e) => {
                                tracing::error!("Failed to open workspace '{}': {:?}", uri, e);
                                (None, None)
                            }
                        }
                    } else {
                        tracing::warn!("Saved workspace '{}' does not exist on disk.", uri);
                        (None, None)
                    }
                }
                None => (None, None),
            };

            let app_state = AppState::new(service, resolved_path);
            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::workspace::get_workspace_status,
            commands::workspace::get_workspace_path,
            commands::workspace::get_meta,
            commands::workspace::get_graph,
            commands::workspace::get_default_workspace_dir,
            commands::workspace::pick_workspace_directory,
            commands::workspace::pick_workspace_file,
            commands::workspace::list_recent_workspaces,
            commands::workspace::open_workspace,
            commands::workspace::create_workspace,
            commands::workspace::create_workspace_file,
            commands::workspace::select_workspace_folder,
            commands::workspace::close_workspace,
            commands::workspace::remove_recent_workspace,
            commands::workspace::toggle_pin_recent_workspace,
            commands::workspace::reveal_workspace_in_explorer,
            commands::workspace::set_workspace_name,
            commands::node::execute_command,
            commands::node::execute_batch,
            commands::kind::get_kinds,
            commands::kind::register_kind,
            commands::kind::delete_kind,
            commands::media::import_asset,
            commands::media::read_asset_data_url,
            commands::media::open_asset,
            commands::media::reveal_asset,
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
        .build(tauri::generate_context!())
        .expect("Tauri Error")
        .run(|app_handle, event| match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.shutdown();
                }
            }
            tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::CloseRequested { .. },
                ..
            } => {
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.shutdown();
                }
            }
            _ => {}
        });
}

pub fn run_headless(workspace_path: PathBuf, port: u16) -> Result<(), String> {
    init_logging();

    if !workspace_path.exists() {
        return Err(format!(
            "Workspace path '{}' does not exist.",
            workspace_path.display()
        ));
    }

    let fs = WorkspaceFs::new(workspace_path.clone());
    fs.init()
        .map_err(|e| format!("Failed to initialize workspace: {:?}", e))?;

    let graph_repo = FsGraphRepository::load(fs.clone())
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
    let asset_repo = FileAssetRepository::new(fs.clone());
    let shell = DesktopSystemShell::new(workspace_path.clone());

    let service = Arc::new(Service::new(
        crate::backend::DynamicGraphRepository::Fs(graph_repo),
        crate::backend::DynamicKindRepository::Fs(kind_repo),
        (),
        crate::backend::DynamicAssetRepository::Fs(asset_repo),
        shell,
    ));

    let _server = HttpSyncServer::start(service, peer_id, device_name, port)
        .map_err(|e| format!("Failed to start sync server: {}", e))?;

    tracing::info!("Kye headless server is running on port {}", port);
    tracing::info!("Press Ctrl+C to stop.");

    loop {
        std::thread::sleep(std::time::Duration::from_secs(3600));
    }
}

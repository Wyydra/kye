use std::net::UdpSocket;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::command::Command;
use infra::dto::{CommandDto, GraphDto, RemoteDto};
use infra::sync::server::HandshakeResponse;

fn get_local_ip() -> Option<String> {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .ok()
        .map(|addr| addr.ip().to_string())
}

#[tauri::command]
pub fn get_local_peer_info() -> AppResult<Option<String>> {
    Ok(get_local_ip())
}

#[tauri::command]
pub fn generate_pairing_qr(port: u16, name: String, pin: String) -> AppResult<String> {
    let ip = get_local_ip()
        .ok_or_else(|| AppError::Internal("Could not resolve local network IP address".into()))?;
    let url = format!("kye-remote://{}:{}?name={}&pin={}", ip, port, name, pin);
    let svg = infra::sync::generate_qr_svg(&url).map_err(|e| AppError::Internal(e))?;
    Ok(svg)
}

#[tauri::command]
pub fn start_p2p_server(
    port: u16,
    peer_id: String,
    device_name: String,
    state: State<'_, AppState>,
) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No active workspace to sync".into()))?;

    state.with_inner(|inner| {
        // Stop active server if running
        if let Some(server) = inner.p2p_server.take() {
            server.stop();
        }

        let server = infra::sync::P2pServer::start(service, peer_id, device_name, port)
            .map_err(|e| AppError::Internal(e))?;

        inner.p2p_server = Some(server);
        Ok(())
    })
}

#[tauri::command]
pub fn stop_p2p_server(state: State<'_, AppState>) -> AppResult<()> {
    state.with_inner(|inner| {
        if let Some(server) = inner.p2p_server.take() {
            server.stop();
        }
        Ok(())
    })
}

#[tauri::command]
pub fn is_p2p_server_running(state: State<'_, AppState>) -> bool {
    state.with_inner(|inner| inner.p2p_server.is_some())
}

#[tauri::command]
pub async fn ping_remote_peer(remote_url: String) -> AppResult<HandshakeResponse> {
    tauri::async_runtime::spawn_blocking(move || {
        infra::sync::ping_remote(&remote_url).map_err(|e| AppError::Internal(e))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub async fn push_to_remote_peer(remote_url: String, cmds: Vec<CommandDto>) -> AppResult<()> {
    let domain_cmds: Vec<Command> = cmds.into_iter().map(Command::from).collect();
    tauri::async_runtime::spawn_blocking(move || {
        infra::sync::push_to_remote(&remote_url, domain_cmds).map_err(|e| AppError::Internal(e))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub async fn pull_remote_peer_graph(remote_url: String) -> AppResult<GraphDto> {
    tauri::async_runtime::spawn_blocking(move || {
        infra::sync::pull_graph_from_remote(&remote_url).map_err(|e| AppError::Internal(e))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub fn get_local_tombstones(
    state: State<'_, AppState>,
) -> AppResult<std::collections::HashMap<String, String>> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let tombstones = service
        .load_tombstones()
        .map_err(|e| AppError::Internal(e.to_string()))?;

    let mut map = std::collections::HashMap::new();
    for (id, time) in tombstones {
        map.insert(id.to_string(), time.to_rfc3339());
    }
    Ok(map)
}

#[tauri::command]
pub async fn pull_remote_peer_tombstones(
    remote_url: String,
) -> AppResult<std::collections::HashMap<String, String>> {
    tauri::async_runtime::spawn_blocking(move || {
        infra::sync::pull_tombstones_from_remote(&remote_url).map_err(|e| AppError::Internal(e))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub fn add_remote(name: String, url: String, state: State<'_, AppState>) -> AppResult<()> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let r_name = domain::model::remote::RemoteName::new(name).map_err(|e| AppError::Internal(e.to_string()))?;
    let r_url = domain::model::remote::RemoteUrl::new(url).map_err(|e| AppError::Internal(e.to_string()))?;
    service.add_remote(r_name, r_url).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(())
}

#[tauri::command]
pub fn remove_remote(name: String, state: State<'_, AppState>) -> AppResult<bool> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let r_name = domain::model::remote::RemoteName::new(name).map_err(|e| AppError::Internal(e.to_string()))?;
    let removed = service.remove_remote(&r_name).map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(removed)
}

#[tauri::command]
pub fn list_remotes(state: State<'_, AppState>) -> AppResult<Vec<RemoteDto>> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;
    let remotes = service.list_remotes().map_err(|e| AppError::Internal(e.to_string()))?;
    Ok(remotes
        .into_iter()
        .map(|r| RemoteDto {
            name: r.name.as_str().to_string(),
            url: r.url.as_str().to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn compute_sync_diff(
    remote_url: String,
    state: State<'_, AppState>,
) -> AppResult<domain::model::sync_diff::SyncDiff> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    tauri::async_runtime::spawn_blocking(move || {
        let peer = infra::sync::HttpSyncPeerAdapter::new();
        service
            .compute_sync_diff(&peer, Some(&remote_url))
            .map_err(|e| AppError::Internal(e.to_string()))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

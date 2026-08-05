use std::net::UdpSocket;
use tauri::State;

use crate::error::{AppError, AppResult};
use crate::state::AppState;
use domain::command::Command;
use domain::ports::SyncPeerPort;
use storage_fs::dto::RemoteDto;
use sync_http::server::HandshakeResponse;
use sync_http::{generate_qr_svg, HttpSyncPeerAdapter, HttpSyncServer};

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
    let svg = generate_qr_svg(&url).map_err(AppError::Internal)?;
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

        let server = HttpSyncServer::start(service, peer_id, device_name, port)
            .map_err(AppError::Internal)?;

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
        let peer = HttpSyncPeerAdapter::new();
        let r_url = domain::model::remote::RemoteUrl::new(remote_url)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        let handshake = peer.ping(&r_url).map_err(|e| AppError::Internal(e.to_string()))?;
        Ok(HandshakeResponse {
            peer_id: handshake.peer_id,
            name: handshake.name,
        })
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub async fn push_to_remote_peer(remote_url: String, cmds: Vec<Command>) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        let peer = HttpSyncPeerAdapter::new();
        let r_url = domain::model::remote::RemoteUrl::new(remote_url)
            .map_err(|e| AppError::Internal(e.to_string()))?;
        peer.push_commands(&r_url, &cmds).map_err(|e| AppError::Internal(e.to_string()))
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
        let peer = HttpSyncPeerAdapter::new();
        service
            .compute_sync_diff(&peer, Some(&remote_url))
            .map_err(|e| AppError::Internal(e.to_string()))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

#[tauri::command]
pub async fn sync_with_remote_peer(
    remote_url: String,
    state: State<'_, AppState>,
) -> AppResult<domain::model::sync_diff::SyncSummary> {
    let service = state
        .service()
        .ok_or_else(|| AppError::Internal("No workspace selected".into()))?;

    tauri::async_runtime::spawn_blocking(move || {
        let peer = HttpSyncPeerAdapter::new();
        service
            .sync_with_peer(&peer, Some(&remote_url))
            .map_err(|e| AppError::Internal(e.to_string()))
    })
    .await
    .map_err(|e| AppError::Internal(format!("Runtime error: {:?}", e)))?
}

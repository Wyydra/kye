use std::time::Duration;
use domain::command::Command;
use super::server::{HandshakeResponse, PushRequest, PushResponse};

/// Pings a remote peer's handshake endpoint to verify the connection.
pub fn ping_remote(remote_url: &str) -> Result<HandshakeResponse, String> {
    let url = format!("{}/api/p2p/handshake", remote_url.trim_end_matches('/'));
    let response: HandshakeResponse = ureq::get(&url)
        .timeout(Duration::from_secs(3))
        .call()
        .map_err(|e| format!("Failed to connect to remote handshake: {:?}", e))?
        .into_json()
        .map_err(|e| format!("Failed to parse handshake JSON: {:?}", e))?;
    Ok(response)
}

use crate::dto::{CommandDto, GraphDto};

/// Pushes a list of local commands to the remote peer's push endpoint.
pub fn push_to_remote(remote_url: &str, cmds: Vec<Command>) -> Result<(), String> {
    let url = format!("{}/api/p2p/push", remote_url.trim_end_matches('/'));
    let dto_cmds: Vec<CommandDto> = cmds.iter().map(CommandDto::from).collect();
    let req_body = PushRequest { cmds: dto_cmds };
    let response: PushResponse = ureq::post(&url)
        .timeout(Duration::from_secs(5))
        .send_json(serde_json::to_value(req_body).unwrap())
        .map_err(|e| format!("Failed to send push request: {:?}", e))?
        .into_json()
        .map_err(|e| format!("Failed to parse push response: {:?}", e))?;

    if response.success {
        Ok(())
    } else {
        Err("Remote peer reported failure applying commands".to_string())
    }
}

/// Pulls the graph from the remote peer.
pub fn pull_graph_from_remote(remote_url: &str) -> Result<GraphDto, String> {
    let url = format!("{}/api/p2p/graph", remote_url.trim_end_matches('/'));
    let response: GraphDto = ureq::get(&url)
        .timeout(Duration::from_secs(5))
        .call()
        .map_err(|e| format!("Failed to fetch remote graph: {:?}", e))?
        .into_json()
        .map_err(|e| format!("Failed to parse remote graph JSON: {:?}", e))?;
    Ok(response)
}

/// Pulls the tombstones from the remote peer.
pub fn pull_tombstones_from_remote(remote_url: &str) -> Result<std::collections::HashMap<String, String>, String> {
    let url = format!("{}/api/p2p/tombstones", remote_url.trim_end_matches('/'));
    let response: std::collections::HashMap<String, String> = ureq::get(&url)
        .timeout(Duration::from_secs(5))
        .call()
        .map_err(|e| format!("Failed to fetch remote tombstones: {:?}", e))?
        .into_json()
        .map_err(|e| format!("Failed to parse remote tombstones JSON: {:?}", e))?;
    Ok(response)
}

use std::collections::HashMap;
use std::time::Duration;

use chrono::{DateTime, Utc};

use domain::command::Command;
use domain::graph::Graph;
use domain::model::primitives::NodeId;
use domain::model::remote::RemoteUrl;
use domain::ports::sync::{PeerHandshake, SyncError, SyncPeerPort};

use super::server::{HandshakeResponse, PushRequest, PushResponse};
use storage_fs::dto::{CommandDto, GraphDto};

#[derive(Debug, Clone, Default)]
pub struct HttpSyncPeerAdapter;

impl HttpSyncPeerAdapter {
    pub fn new() -> Self {
        Self
    }
}

impl SyncPeerPort for HttpSyncPeerAdapter {
    fn ping(&self, remote_url: &RemoteUrl) -> Result<PeerHandshake, SyncError> {
        let url = format!("{}/api/p2p/handshake", remote_url.as_str().trim_end_matches('/'));
        let response: HandshakeResponse = ureq::get(&url)
            .timeout(Duration::from_secs(4))
            .call()
            .map_err(|e| SyncError::Network(e.to_string()))?
            .into_json()
            .map_err(|e| SyncError::Serialization(e.to_string()))?;

        Ok(PeerHandshake {
            peer_id: response.peer_id,
            name: response.name,
        })
    }

    fn push_commands(&self, remote_url: &RemoteUrl, cmds: &[Command]) -> Result<(), SyncError> {
        let url = format!("{}/api/p2p/push", remote_url.as_str().trim_end_matches('/'));
        let dto_cmds: Vec<CommandDto> = cmds.iter().map(CommandDto::from).collect();
        let req_body = PushRequest { cmds: dto_cmds };

        let response: PushResponse = ureq::post(&url)
            .timeout(Duration::from_secs(6))
            .send_json(serde_json::to_value(req_body).map_err(|e| SyncError::Serialization(e.to_string()))?)
            .map_err(|e| SyncError::Network(e.to_string()))?
            .into_json()
            .map_err(|e| SyncError::Serialization(e.to_string()))?;

        if response.success {
            Ok(())
        } else {
            Err(SyncError::RemoteStatus {
                status: 500,
                message: "Remote peer failed applying commands".to_string(),
            })
        }
    }

    fn pull_graph(&self, remote_url: &RemoteUrl) -> Result<Graph, SyncError> {
        let url = format!("{}/api/p2p/graph", remote_url.as_str().trim_end_matches('/'));
        let dto: GraphDto = ureq::get(&url)
            .timeout(Duration::from_secs(6))
            .call()
            .map_err(|e| SyncError::Network(e.to_string()))?
            .into_json()
            .map_err(|e| SyncError::Serialization(e.to_string()))?;

        Ok(dto.to_graph())
    }

    fn pull_tombstones(&self, remote_url: &RemoteUrl) -> Result<HashMap<NodeId, DateTime<Utc>>, SyncError> {
        let url = format!("{}/api/p2p/tombstones", remote_url.as_str().trim_end_matches('/'));
        let response = match ureq::get(&url).timeout(Duration::from_secs(5)).call() {
            Ok(res) => res,
            Err(ureq::Error::Status(404, _)) => {
                return Ok(HashMap::new());
            }
            Err(e) => return Err(SyncError::Network(e.to_string())),
        };

        let parsed: HashMap<String, String> = response
            .into_json()
            .map_err(|e| SyncError::Serialization(e.to_string()))?;

        let mut result = HashMap::new();
        for (id_str, time_str) in parsed {
            if let Ok(id_uuid) = uuid::Uuid::parse_str(&id_str)
                && let Ok(dt) = DateTime::parse_from_rfc3339(&time_str)
            {
                result.insert(NodeId::from_uuid(id_uuid), dt.with_timezone(&Utc));
            }
        }

        Ok(result)
    }
}

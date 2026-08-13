use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::command::Command;
use crate::graph::Graph;
use crate::model::primitives::NodeId;
use crate::model::remote::RemoteUrl;

#[derive(Debug, thiserror::Error)]
pub enum SyncError {
    #[error("Network connection failed: {0}")]
    Network(String),
    #[error("Remote server error ({status}): {message}")]
    RemoteStatus { status: u16, message: String },
    #[error("Data parsing error: {0}")]
    Serialization(String),
    #[error("Handshake failed: {0}")]
    HandshakeFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerHandshake {
    pub peer_id: String,
    pub name: String,
}

pub trait SyncPeerPort: Send + Sync + 'static {
    fn ping(&self, url: &RemoteUrl) -> Result<PeerHandshake, SyncError>;
    fn push_commands(&self, url: &RemoteUrl, cmds: &[Command]) -> Result<(), SyncError>;
    fn pull_graph(&self, url: &RemoteUrl) -> Result<Graph, SyncError>;
    fn pull_tombstones(&self, url: &RemoteUrl)
    -> Result<HashMap<NodeId, DateTime<Utc>>, SyncError>;
}

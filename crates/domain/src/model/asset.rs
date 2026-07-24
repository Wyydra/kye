use crate::primitives::NodeId;
use serde::{Deserialize, Serialize};

/// Domain Model representing an Asset and its associated Sidecar file metadata.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AssetInfo {
    pub node_id: Option<NodeId>,
    pub target_path: String,
    pub sidecar_path: String,
    pub mime_type: String,
    pub size_bytes: u64,
}

impl AssetInfo {
    pub fn new(
        target_path: impl Into<String>,
        sidecar_path: impl Into<String>,
        mime_type: impl Into<String>,
        size_bytes: u64,
    ) -> Self {
        Self {
            node_id: None,
            target_path: target_path.into(),
            sidecar_path: sidecar_path.into(),
            mime_type: mime_type.into(),
            size_bytes,
        }
    }

    pub fn with_node_id(mut self, id: NodeId) -> Self {
        self.node_id = Some(id);
        self
    }
}

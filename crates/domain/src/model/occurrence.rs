use crate::primitives::NodeId;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct NodeOccurrence {
    pub id: Uuid,
    pub node_id: NodeId,
    pub canvas_id: NodeId,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub z_index: i32,
    pub detail_level: DetailLevel,
}

impl NodeOccurrence {
    pub fn new(
        node_id: NodeId,
        canvas_id: NodeId,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            node_id,
            canvas_id,
            x,
            y,
            width,
            height,
            z_index: 0,
            detail_level: DetailLevel::Full,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum DetailLevel {
    Compact,
    #[default]
    Full,
    Expanded,
}

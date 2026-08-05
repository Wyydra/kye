use crate::command::Event;
use crate::primitives::NodeId;
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository, SystemShellPort};

use super::service::{Service, ServiceError};

impl<R, K, E, A, S> Service<R, K, E, A, S>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
    S: SystemShellPort,
{
    pub fn import_asset(&self, source_path: &str) -> Result<NodeId, ServiceError> {
        let asset_node = self.asset_repo.import_asset(source_path)?;
        let node_id = asset_node.id;

        let event = Event::NodeCreated {
            node: asset_node,
            parent_id: None,
            index: 0,
        };

        self.repo.apply_event(&event)?;
        self.bus.publish(&event);
        Ok(node_id)
    }
}

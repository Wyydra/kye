use std::sync::Arc;

use crate::command::Event;
use crate::model::asset::AssetInfo;
use crate::node::NodeBuilder;
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository};
use crate::primitives::PropKey;
use crate::value::{Props, Value};

use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn import_asset(&self, source_path: &str) -> Result<AssetInfo, ServiceError> {
        let asset_info = self.asset_repo.import_asset(source_path)?;
        if let Some(node_id) = asset_info.node_id {
            let filename = std::path::Path::new(source_path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Asset");

            let kind_str = if asset_info.mime_type.starts_with("image/") {
                "core.image"
            } else {
                "core.file"
            };

            let mut props = Props::new();
            props.insert(
                PropKey::from("target"),
                Value::Text(Arc::from(asset_info.target_path.as_str())),
            );
            props.insert(
                PropKey::from("mime_type"),
                Value::Text(Arc::from(asset_info.mime_type.as_str())),
            );
            props.insert(
                PropKey::from("size_bytes"),
                Value::Int(asset_info.size_bytes as i64),
            );
            props.insert(
                PropKey::from("title"),
                Value::Text(Arc::from(filename)),
            );

            let sidecar_node = NodeBuilder::new(kind_str, chrono::Utc::now())
                .with_id(node_id)
                .with_props(props)
                .build();

            let event = Event::NodeCreated {
                node: sidecar_node,
                parent_id: None,
                index: 0,
            };

            self.repo.apply_event(&event)?;
            self.bus.publish(&event);
        }
        Ok(asset_info)
    }

    pub fn open_external(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.asset_repo.open_external(target_path)?)
    }

    pub fn reveal_in_explorer(&self, target_path: &str) -> Result<(), ServiceError> {
        Ok(self.asset_repo.reveal_in_explorer(target_path)?)
    }
}

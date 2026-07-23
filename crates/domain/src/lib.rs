

pub mod primitives;
pub mod value;
pub mod node;
pub mod workspace;
pub mod view;
pub mod graph;
pub mod query;
pub mod resolver;
pub mod schema;
pub mod registry;
pub mod command;
pub mod asset;
pub mod ports;
pub mod service;

pub use primitives::{NodeId, Kind, PropKey, kinds, props};
pub use value::{Value, RichText, Span, Mark, Color, Props};
pub use node::{Node, NodeBuilder};
pub use asset::AssetInfo;
pub use workspace::WorkspaceMeta;

pub use graph::{Graph, GraphError};
pub use query::{QueryBuilder, SortDir};
pub use resolver::SchemaResolver;
pub use schema::{KindDef, PropDef, ValueType, Constraint, ValidationError};
pub use view::{ViewDef, Layout, Direction, ActionDef, ActionKind};
pub use registry::{KindRegistry, CoreLibrary};
pub use command::{Command, Event, CommandError, apply};
pub use ports::{GraphRepository, KindRepository, EventBus, AssetRepository, RepositoryError};
pub use service::{Service, ServiceError};

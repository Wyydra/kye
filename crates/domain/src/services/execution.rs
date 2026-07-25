use chrono::Utc;

use crate::command::{apply, Command, CommandError, Event};
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository};
use crate::primitives::NodeId;
use crate::query::{evaluate_query_node, QueryBuilder};
use crate::resolver::SchemaResolver;
use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn execute(&self, cmd: Command) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let event = apply(&mut graph, &registry, cmd, Utc::now())?;

        drop(registry);
        self.repo.apply_event(&event)?;
        self.bus.publish(&event);

        Ok(event)
    }

    pub fn execute_batch(&self, cmds: Vec<Command>) -> Result<Event, ServiceError> {
        let mut graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;

        let snapshot = graph.clone();

        let mut events = Vec::new();
        let now = Utc::now();

        for cmd in cmds {
            match apply(&mut graph, &registry, cmd, now) {
                Ok(event) => events.push(event),
                Err(e) => {
                    drop(graph);
                    drop(snapshot);
                    return Err(ServiceError::Command(e));
                }
            }
        }

        drop(registry);
        let batch_event = Event::Batch(events);
        self.repo.apply_event(&batch_event)?;
        self.bus.publish(&batch_event);

        Ok(batch_event)
    }

    pub fn execute_query(&self, builder: QueryBuilder) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(builder.execute(&graph))
    }

    pub fn evaluate_query_node(&self, query_node_id: NodeId) -> Result<Vec<NodeId>, ServiceError> {
        let graph = self.repo.load_graph()?;
        Ok(evaluate_query_node(&graph, query_node_id))
    }

    pub fn validate_node_in_context(&self, node_id: NodeId) -> Result<(), ServiceError> {
        let graph = self.repo.load_graph()?;
        let registry = self
            .registry
            .read()
            .map_err(|_| ServiceError::LockPoisoned)?;
        let resolver = SchemaResolver::new(&graph, &registry);
        resolver
            .validate_in_context(node_id)
            .map_err(|_e| ServiceError::Command(CommandError::NotFound(node_id)))
    }
}

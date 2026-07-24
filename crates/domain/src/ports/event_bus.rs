use crate::services::command::Event;

pub trait EventBus: Send + Sync + 'static {
    fn publish(&self, event: &Event);
}

impl EventBus for () {
    fn publish(&self, _event: &Event) {}
}

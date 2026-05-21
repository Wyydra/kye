use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;
use super::BlockFormatter;

pub struct TaskFormatter;

impl BlockFormatter for TaskFormatter {
    fn kind(&self) -> &'static str { "core.task" }

    fn matches(&self, text: &str) -> bool {
        text.starts_with("- [ ]") || text.starts_with("- [x]")
    }

    fn native_keys(&self) -> &'static [&'static str] { &["checked", "title"] }

    fn format(&self, props: &Props) -> String {
        let checked = props.get(&PropKey::from("checked"))
            .and_then(|v| if let Value::Bool(b) = v { Some(*b) } else { None })
            .unwrap_or(false);
        let title = props.get(&PropKey::from("title"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
        format!("- [{}] {}", if checked { "x" } else { " " }, title)
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        props.insert(PropKey::from("checked"), Value::Bool(text.starts_with("- [x]")));
        props.insert(PropKey::from("title"), Value::Text(Arc::from(text[5..].trim())));
        props
    }
}

use super::{BlockFormatter, markdown_to_rich, value_to_markdown};
use domain::primitives::PropKey;
use domain::value::{Props, Value};

pub struct TaskFormatter;

impl BlockFormatter for TaskFormatter {
    fn kind(&self) -> &'static str {
        "core.task"
    }

    fn matches(&self, text: &str) -> bool {
        text.starts_with("- [ ]") || text.starts_with("- [x]")
    }

    fn native_keys(&self) -> &'static [&'static str] {
        &["checked", "title"]
    }

    fn format(&self, props: &Props) -> String {
        let checked = props
            .get(&PropKey::from("checked"))
            .and_then(|v| {
                if let Value::Bool(b) = v {
                    Some(*b)
                } else {
                    None
                }
            })
            .unwrap_or(false);
        let title = props
            .get(&PropKey::from("title"))
            .map(value_to_markdown)
            .unwrap_or_default();
        format!("- [{}] {}", if checked { "x" } else { " " }, title)
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        props.insert(
            PropKey::from("checked"),
            Value::Bool(text.starts_with("- [x]")),
        );
        let title_part = text[5..].trim();
        props.insert(
            PropKey::from("title"),
            Value::Rich(markdown_to_rich(title_part)),
        );
        props
    }
}

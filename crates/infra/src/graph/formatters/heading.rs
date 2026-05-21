use domain::primitives::PropKey;
use domain::value::{Props, Value};
use super::{BlockFormatter, value_to_markdown, markdown_to_rich};

pub struct HeadingFormatter;

impl BlockFormatter for HeadingFormatter {
    fn kind(&self) -> &'static str { "core.heading" }

    fn matches(&self, text: &str) -> bool { text.starts_with('#') }

    fn native_keys(&self) -> &'static [&'static str] { &["level", "body"] }

    fn format(&self, props: &Props) -> String {
        let body = props.get(&PropKey::from("body"))
            .map(value_to_markdown)
            .unwrap_or_default();
        let level = props.get(&PropKey::from("level"))
            .and_then(|v| if let Value::Int(i) = v { Some(*i as usize) } else { None })
            .unwrap_or(1);
        format!("{} {}", "#".repeat(level.clamp(1, 6)), body)
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        let level = text.chars().take_while(|c| *c == '#').count();
        props.insert(PropKey::from("level"), Value::Int(level as i64));
        let title_part = text[level..].trim();
        props.insert(PropKey::from("body"), Value::Rich(markdown_to_rich(title_part)));
        props
    }
}


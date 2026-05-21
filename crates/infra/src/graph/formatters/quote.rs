use domain::primitives::PropKey;
use domain::value::{Props, Value};
use super::{BlockFormatter, value_to_markdown, markdown_to_rich};

pub struct QuoteFormatter;

impl BlockFormatter for QuoteFormatter {
    fn kind(&self) -> &'static str { "core.quote" }

    fn matches(&self, text: &str) -> bool { text.starts_with("> ") }

    fn native_keys(&self) -> &'static [&'static str] { &["body"] }

    fn format(&self, props: &Props) -> String {
        let body = props.get(&PropKey::from("body"))
            .map(value_to_markdown)
            .unwrap_or_default();
        body.lines()
            .map(|l| format!("> {}", l))
            .collect::<Vec<_>>()
            .join("\n")
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        let body = text.lines()
            .map(|l| l.strip_prefix("> ").unwrap_or(l))
            .collect::<Vec<_>>()
            .join("\n");
        props.insert(PropKey::from("body"), Value::Rich(markdown_to_rich(&body)));
        props
    }
}


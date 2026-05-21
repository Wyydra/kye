use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;
use super::BlockFormatter;

pub struct QuoteFormatter;

impl BlockFormatter for QuoteFormatter {
    fn kind(&self) -> &'static str { "core.quote" }

    fn matches(&self, text: &str) -> bool { text.starts_with("> ") }

    fn native_keys(&self) -> &'static [&'static str] { &["body"] }

    fn format(&self, props: &Props) -> String {
        let body = props.get(&PropKey::from("body"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
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
        props.insert(PropKey::from("body"), Value::Text(Arc::from(body.as_str())));
        props
    }
}

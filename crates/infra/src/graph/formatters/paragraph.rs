use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;
use super::BlockFormatter;

/// Fallback formatter — matches any text that no other formatter claims.
pub struct ParagraphFormatter;

impl BlockFormatter for ParagraphFormatter {
    fn kind(&self) -> &'static str { "core.paragraph" }

    fn matches(&self, _text: &str) -> bool { true }

    fn native_keys(&self) -> &'static [&'static str] { &["body"] }

    fn format(&self, props: &Props) -> String {
        props.get(&PropKey::from("body"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref().to_string()) } else { None })
            .unwrap_or_default()
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        props.insert(PropKey::from("body"), Value::Text(Arc::from(text)));
        props
    }
}

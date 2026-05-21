use domain::primitives::PropKey;
use domain::value::{Props, Value};
use super::{BlockFormatter, value_to_markdown, markdown_to_rich};

/// Fallback formatter — matches any text that no other formatter claims.
pub struct ParagraphFormatter;

impl BlockFormatter for ParagraphFormatter {
    fn kind(&self) -> &'static str { "core.paragraph" }

    fn matches(&self, _text: &str) -> bool { true }

    fn native_keys(&self) -> &'static [&'static str] { &["body"] }

    fn format(&self, props: &Props) -> String {
        props.get(&PropKey::from("body"))
            .map(value_to_markdown)
            .unwrap_or_default()
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        props.insert(PropKey::from("body"), Value::Rich(markdown_to_rich(text)));
        props
    }
}


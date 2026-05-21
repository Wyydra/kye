use domain::value::Props;
use super::BlockFormatter;

pub struct DividerFormatter;

impl BlockFormatter for DividerFormatter {
    fn kind(&self) -> &'static str { "core.divider" }

    fn matches(&self, text: &str) -> bool { text == "---" }

    fn native_keys(&self) -> &'static [&'static str] { &[] }

    fn format(&self, _props: &Props) -> String { "---".to_string() }

    fn extract(&self, _text: &str) -> Props { Props::new() }
}

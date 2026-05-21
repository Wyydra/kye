use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;
use super::BlockFormatter;

pub struct CodeBlockFormatter;

impl BlockFormatter for CodeBlockFormatter {
    fn kind(&self) -> &'static str { "core.code_block" }

    fn matches(&self, text: &str) -> bool { text.starts_with("```") }

    fn native_keys(&self) -> &'static [&'static str] { &["language", "body"] }

    fn format(&self, props: &Props) -> String {
        let language = props.get(&PropKey::from("language"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
        let body = props.get(&PropKey::from("body"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
        format!("```{}\n{}\n```", language, body)
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        let lines: Vec<&str> = text.lines().collect();
        if lines.len() >= 2 {
            props.insert(PropKey::from("language"), Value::Text(Arc::from(lines[0][3..].trim())));
            let body = lines[1..lines.len() - 1].join("\n");
            props.insert(PropKey::from("body"), Value::Text(Arc::from(body.as_str())));
        }
        props
    }
}

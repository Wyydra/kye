use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;
use super::BlockFormatter;

pub struct ImageFormatter;

impl BlockFormatter for ImageFormatter {
    fn kind(&self) -> &'static str { "core.image" }

    fn matches(&self, text: &str) -> bool {
        text.starts_with("![") && text.contains("](")
    }

    fn native_keys(&self) -> &'static [&'static str] { &["url", "alt"] }

    fn format(&self, props: &Props) -> String {
        let url = props.get(&PropKey::from("url"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
        let alt = props.get(&PropKey::from("alt"))
            .and_then(|v| if let Value::Text(t) = v { Some(t.as_ref()) } else { None })
            .unwrap_or("");
        format!("![{}]({})", alt, url)
    }

    fn extract(&self, text: &str) -> Props {
        use pulldown_cmark::{Event, Options, Parser, Tag};
        let mut props = Props::new();
        let mut in_image = false;
        let mut url = String::new();
        let mut alt_parts: Vec<String> = Vec::new();

        for event in Parser::new_ext(text, Options::empty()) {
            match event {
                Event::Start(Tag::Image { dest_url, .. }) => {
                    url = dest_url.into_string();
                    in_image = true;
                }
                Event::Text(t) if in_image => alt_parts.push(t.into_string()),
                Event::End(_) if in_image => in_image = false,
                _ => {}
            }
        }

        if !url.is_empty() {
            props.insert(PropKey::from("url"), Value::Text(Arc::from(url.as_str())));
            props.insert(PropKey::from("alt"), Value::Text(Arc::from(alt_parts.join("").as_str())));
        }
        props
    }
}

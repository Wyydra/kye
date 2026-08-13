use super::BlockFormatter;
use domain::primitives::PropKey;
use domain::value::{Props, Value};
use std::sync::Arc;

pub struct AudioFormatter;

impl BlockFormatter for AudioFormatter {
    fn kind(&self) -> &'static str {
        "core.audio"
    }

    fn matches(&self, text: &str) -> bool {
        text.starts_with("![audio](") || text.starts_with("![Audio](")
    }

    fn native_keys(&self) -> &'static [&'static str] {
        &["url", "title"]
    }

    fn format(&self, props: &Props) -> String {
        let url = props
            .get(&PropKey::from("url"))
            .map(|v| match v {
                Value::Ref(id) => id.to_string(),
                Value::Text(t) => t.to_string(),
                _ => String::new(),
            })
            .unwrap_or_default();

        let title = props
            .get(&PropKey::from("title"))
            .and_then(|v| v.as_text())
            .unwrap_or("audio");

        format!(
            "![{}]({})",
            if title.is_empty() { "audio" } else { title },
            url
        )
    }

    fn extract(&self, text: &str) -> Props {
        use pulldown_cmark::{Event, Options, Parser, Tag};
        let mut props = Props::new();
        let mut in_image = false;
        let mut url_str = String::new();
        let mut title_parts: Vec<String> = Vec::new();

        for event in Parser::new_ext(text, Options::empty()) {
            match event {
                Event::Start(Tag::Image { dest_url, .. }) => {
                    url_str = dest_url.into_string();
                    in_image = true;
                }
                Event::Text(t) if in_image => title_parts.push(t.into_string()),
                Event::End(_) if in_image => in_image = false,
                _ => {}
            }
        }

        if !url_str.is_empty() {
            let val = if let Ok(uuid) = uuid::Uuid::parse_str(&url_str) {
                Value::Ref(domain::NodeId::from_uuid(uuid))
            } else {
                Value::Text(Arc::from(url_str.as_str()))
            };

            props.insert(PropKey::from("url"), val);
            let title_str = title_parts.join("");
            if !title_str.is_empty() {
                props.insert(
                    PropKey::from("title"),
                    Value::Text(Arc::from(title_str.as_str())),
                );
            }
        }
        props
    }
}

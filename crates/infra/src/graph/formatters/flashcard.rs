use super::{BlockFormatter, markdown_to_rich, value_to_markdown};
use domain::primitives::PropKey;
use domain::value::{Props, Value};

pub struct FlashcardFormatter;

impl BlockFormatter for FlashcardFormatter {
    fn kind(&self) -> &'static str {
        "core.flashcard"
    }

    fn matches(&self, text: &str) -> bool {
        let lines: Vec<&str> = text.lines().map(|l| l.trim()).collect();
        if lines.is_empty() {
            return false;
        }
        let first = lines[0];
        first.starts_with("> **Front**:")
            || first.starts_with("> **Front** :")
            || first.starts_with("> **Question**:")
    }

    fn native_keys(&self) -> &'static [&'static str] {
        &["front", "back"]
    }

    fn format(&self, props: &Props) -> String {
        let front = props
            .get(&PropKey::from("front"))
            .map(value_to_markdown)
            .unwrap_or_default();
        let back = props
            .get(&PropKey::from("back"))
            .map(value_to_markdown)
            .unwrap_or_default();
        format!("> **Front**: {}\n>\n> **Back**: {}", front, back)
    }

    fn extract(&self, text: &str) -> Props {
        let mut props = Props::new();
        let mut front_lines = Vec::new();
        let mut back_lines = Vec::new();
        let mut parsing_back = false;

        for line in text.lines() {
            let clean = line
                .strip_prefix("> ")
                .unwrap_or(line.strip_prefix(">").unwrap_or(line))
                .trim();
            if clean.starts_with("**Front**:") {
                let content = clean.strip_prefix("**Front**:").unwrap().trim();
                front_lines.push(content);
            } else if clean.starts_with("**Front** :") {
                let content = clean.strip_prefix("**Front** :").unwrap().trim();
                front_lines.push(content);
            } else if clean.starts_with("**Question**:") {
                let content = clean.strip_prefix("**Question**:").unwrap().trim();
                front_lines.push(content);
            } else if clean.starts_with("**Back**:") {
                let content = clean.strip_prefix("**Back**:").unwrap().trim();
                back_lines.push(content);
                parsing_back = true;
            } else if clean.starts_with("**Answer**:") {
                let content = clean.strip_prefix("**Answer**:").unwrap().trim();
                back_lines.push(content);
                parsing_back = true;
            } else {
                if parsing_back {
                    back_lines.push(clean);
                } else if !front_lines.is_empty() {
                    front_lines.push(clean);
                }
            }
        }

        let front_text = front_lines.join("\n").trim().to_string();
        let back_text = back_lines.join("\n").trim().to_string();

        props.insert(
            PropKey::from("front"),
            Value::Rich(markdown_to_rich(&front_text)),
        );
        props.insert(
            PropKey::from("back"),
            Value::Rich(markdown_to_rich(&back_text)),
        );
        props
    }
}

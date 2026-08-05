//! Generic Markdown block metadata layer.
//!
//! Every inline block node (heading, task, image, …) stored inside a `core.page`
//! document needs to carry its domain `NodeId` and any props that cannot be
//! expressed in Markdown syntax ("hidden props"). We encode these as an
//! HTML comment that editors and diff tools simply ignore.
//!
//! For standard blocks, this comment is placed at the end of the block.
//! For fenced code blocks, putting the HTML comment at the end (after the closing fence)
//! breaks standard CommonMark spec compliance. Thus, we put the comment on the opening fence line.
//!
//! This module is the **single** place that reads and writes that comment format.
//! Neither the individual `BlockFormatter` implementations nor `serializer.rs`
//! should contain any knowledge of this encoding.

use std::collections::HashMap;

use domain::primitives::NodeId;
use uuid::Uuid;

// ── Parsed representation ────────────────────────────────────────────────────

/// The result of parsing one Markdown paragraph from a `core.page` document.
pub struct ParsedBlock {
    /// The stable identity for this node.
    pub node_id: NodeId,
    /// The raw Markdown content, with the trailing HTML comment removed.
    pub markdown_text: String,
    /// Extra props that were not expressible in Markdown, stored in the comment.
    pub hidden_props: HashMap<String, serde_yaml::Value>,
}

impl ParsedBlock {
    /// Parse a raw Markdown paragraph (a single `\n\n`-separated block).
    ///
    /// If no `<!-- id: … -->` comment is found the block gets a fresh `NodeId`
    /// and no hidden props — this handles files edited by hand or created by
    /// other tools.
    pub fn parse(raw: &str) -> Self {
        if let Some(comment_start) = raw.find("<!-- id: ")
            && let Some(comment_end_offset) = raw[comment_start..].find(" -->")
        {
            let comment_end = comment_start + comment_end_offset;
            let comment = &raw[comment_start + 9..comment_end]; // strip "<!-- id: " … " -->"

            // Reconstruct the raw markdown text without the comment.
            let mut markdown_text = raw[..comment_start].trim_end().to_string();
            let after_comment = &raw[comment_end + 4..];
            markdown_text.push_str(after_comment);

            let (node_id, hidden_props) = if let Some(props_offset) = comment.find(" props: ") {
                let id_str = &comment[..props_offset];
                let props_json = &comment[props_offset + 8..];
                let id = Uuid::parse_str(id_str)
                    .map(NodeId::from_uuid)
                    .unwrap_or_else(|_| NodeId::new());
                let props: HashMap<String, serde_yaml::Value> =
                    serde_json::from_str(props_json).unwrap_or_default();
                (id, props)
            } else {
                let id = Uuid::parse_str(comment)
                    .map(NodeId::from_uuid)
                    .unwrap_or_else(|_| NodeId::new());
                (id, HashMap::new())
            };

            return Self {
                node_id,
                markdown_text,
                hidden_props,
            };
        }

        // No comment found — treat the entire text as content, assign a fresh id.
        Self {
            node_id: NodeId::new(),
            markdown_text: raw.to_string(),
            hidden_props: HashMap::new(),
        }
    }
}

// ── Serialization ────────────────────────────────────────────────────────────

/// Render one block line: Markdown content followed by the metadata comment.
///
/// `native_text`  — output of `BlockFormatter::format()`
/// `hidden_props` — props not expressible in Markdown (non-native keys)
pub fn serialize_block_line(
    node_id: NodeId,
    native_text: &str,
    hidden_props: HashMap<String, serde_yaml::Value>,
) -> String {
    let mut comment = format!("<!-- id: {}", node_id.as_uuid());
    if !hidden_props.is_empty()
        && let Ok(json) = serde_json::to_string(&hidden_props)
    {
        comment.push_str(&format!(" props: {}", json));
    }
    comment.push_str(" -->");

    if native_text.is_empty() {
        comment
    } else if let Some(first_line_end) = native_text.find('\n') {
        let (first, rest) = native_text.split_at(first_line_end);
        format!("{} {}{}", first.trim_end(), comment, rest)
    } else {
        format!("{} {}", native_text.trim_end(), comment)
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_with_hidden_props() {
        let id = NodeId::new();
        let mut hidden: HashMap<String, serde_yaml::Value> = HashMap::new();
        hidden.insert("priority".to_string(), serde_yaml::Value::Number(2.into()));

        let line = serialize_block_line(id, "- [ ] Buy milk", hidden.clone());
        let parsed = ParsedBlock::parse(&line);

        assert_eq!(parsed.node_id, id);
        assert_eq!(parsed.markdown_text, "- [ ] Buy milk");
        assert_eq!(
            parsed.hidden_props["priority"],
            serde_yaml::Value::Number(2.into())
        );
    }

    #[test]
    fn round_trip_code_block() {
        let id = NodeId::new();
        let mut hidden: HashMap<String, serde_yaml::Value> = HashMap::new();
        hidden.insert("x".to_string(), serde_yaml::Value::Number(42.into()));

        let code_content = "```rust\nlet a = 12;\n```";
        let line = serialize_block_line(id, code_content, hidden.clone());

        // Assert the comment is indeed on the first line
        assert!(line.starts_with("```rust <!-- id:"));

        let parsed = ParsedBlock::parse(&line);
        assert_eq!(parsed.node_id, id);
        assert_eq!(parsed.markdown_text, code_content);
        assert_eq!(
            parsed.hidden_props["x"],
            serde_yaml::Value::Number(42.into())
        );
    }

    #[test]
    fn round_trip_no_hidden_props() {
        let id = NodeId::new();
        let line = serialize_block_line(id, "---", HashMap::new());
        let parsed = ParsedBlock::parse(&line);

        assert_eq!(parsed.node_id, id);
        assert_eq!(parsed.markdown_text, "---");
        assert!(parsed.hidden_props.is_empty());
    }

    #[test]
    fn parse_plain_text_without_comment() {
        let parsed = ParsedBlock::parse("Just some text with no metadata");
        assert_eq!(parsed.markdown_text, "Just some text with no metadata");
        assert!(parsed.hidden_props.is_empty());
        // A fresh id is assigned — just check it doesn't panic.
    }

    #[test]
    fn test_flashcard_formatting() {
        use crate::graph::formatters::REGISTRY;
        use domain::primitives::PropKey;
        use domain::value::{Props, Value};

        let formatter = REGISTRY.get_by_kind("core.flashcard");
        assert_eq!(formatter.kind(), "core.flashcard");

        let mut props = Props::new();
        props.insert(
            PropKey::from("front"),
            Value::Rich(super::super::markdown_to_rich("What is **this**?")),
        );
        props.insert(
            PropKey::from("back"),
            Value::Rich(super::super::markdown_to_rich("This is a *flashcard*!")),
        );

        let formatted = formatter.format(&props);
        assert_eq!(
            formatted,
            "> **Front**: What is **this**?\n>\n> **Back**: This is a *flashcard*!"
        );

        assert!(formatter.matches(&formatted));

        let extracted = formatter.extract(&formatted);
        let ext_front = extracted.get(&PropKey::from("front")).unwrap();
        let ext_back = extracted.get(&PropKey::from("back")).unwrap();

        // Convert back to markdown to verify matches
        assert_eq!(
            super::super::value_to_markdown(ext_front),
            "What is **this**?"
        );
        assert_eq!(
            super::super::value_to_markdown(ext_back),
            "This is a *flashcard*!"
        );

        // Verify metadata comment is appended to the first line (Front) of the block quote
        let block_id = NodeId::new();
        let serialized = serialize_block_line(block_id, &formatted, HashMap::new());
        assert!(serialized.starts_with(&format!(
            "> **Front**: What is **this**? <!-- id: {}",
            block_id.as_uuid()
        )));

        // Ensure parsing the serialized block line correctly recovers the comment and native text
        let parsed = ParsedBlock::parse(&serialized);
        assert_eq!(parsed.node_id, block_id);
        assert_eq!(parsed.markdown_text, formatted);
    }
}

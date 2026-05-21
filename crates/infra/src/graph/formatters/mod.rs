pub mod block;
pub mod heading;
pub mod task;
pub mod image;
pub mod quote;
pub mod code_block;
pub mod divider;
pub mod paragraph;
pub mod flashcard;

use domain::value::{Props, Value, RichText, Span, Mark};
use once_cell::sync::Lazy;
use std::sync::Arc;
use pulldown_cmark::{Parser, Event, Tag, TagEnd, Options};

pub fn rich_to_markdown(rt: &RichText) -> String {
    let mut out = String::new();
    for span in &rt.0 {
        let mut text = span.text.as_ref().to_string();
        for mark in &span.marks {
            match mark {
                Mark::Bold => text = format!("**{}**", text),
                Mark::Italic => text = format!("*{}*", text),
                Mark::Code => text = format!("`{}`", text),
                Mark::Strikethrough => text = format!("~~{}~~", text),
                Mark::Underline => text = format!("<u>{}</u>", text),
                Mark::Link(url) => text = format!("[{}]({})", text, url),
                _ => {}
            }
        }
        out.push_str(&text);
    }
    out
}

pub fn markdown_to_rich(md: &str) -> RichText {
    let mut spans = Vec::new();
    let mut current_marks = smallvec::SmallVec::new();
    let parser = Parser::new_ext(md, Options::empty());

    for event in parser {
        match event {
            Event::Start(tag) => {
                match tag {
                    Tag::Strong => current_marks.push(Mark::Bold),
                    Tag::Emphasis => current_marks.push(Mark::Italic),
                    Tag::Strikethrough => current_marks.push(Mark::Strikethrough),
                    Tag::Link { dest_url, .. } => current_marks.push(Mark::Link(Arc::from(dest_url.as_ref()))),
                    _ => {}
                }
            }
            Event::End(tag_end) => {
                let target_mark = match tag_end {
                    TagEnd::Strong => Some(Mark::Bold),
                    TagEnd::Emphasis => Some(Mark::Italic),
                    TagEnd::Strikethrough => Some(Mark::Strikethrough),
                    TagEnd::Link => {
                        if let Some(pos) = current_marks.iter().position(|m| matches!(m, Mark::Link(_))) {
                            current_marks.remove(pos);
                        }
                        None
                    }
                    _ => None,
                };
                if let Some(m) = target_mark {
                    if let Some(pos) = current_marks.iter().position(|x| x == &m) {
                        current_marks.remove(pos);
                    }
                }
            }
            Event::Text(t) => {
                spans.push(Span {
                    text: Arc::from(t.as_ref()),
                    marks: current_marks.clone(),
                });
            }
            Event::Code(t) => {
                let mut marks = current_marks.clone();
                marks.push(Mark::Code);
                spans.push(Span {
                    text: Arc::from(t.as_ref()),
                    marks,
                });
            }
            _ => {}
        }
    }

    if spans.is_empty() && !md.is_empty() {
        spans.push(Span {
            text: Arc::from(md),
            marks: smallvec::SmallVec::new(),
        });
    }

    RichText(spans)
}

pub fn value_to_markdown(v: &Value) -> String {
    match v {
        Value::Text(t) => t.as_ref().to_string(),
        Value::Rich(rt) => rich_to_markdown(rt),
        _ => String::new(),
    }
}

/// Describes how a specific block kind maps to and from Markdown text.
///
/// Each formatter is responsible **only** for its own Markdown syntax
/// (e.g. `- [ ] …` for tasks). The HTML metadata comment (`<!-- id: … -->`)
/// and YAML frontmatter are handled generically by `block.rs` and
/// `serializer.rs` respectively — formatters never touch them.
pub trait BlockFormatter: Send + Sync {
    /// The domain kind identifier (e.g. `"core.task"`).
    fn kind(&self) -> &'static str;

    /// Returns `true` if this formatter should handle the given Markdown text.
    fn matches(&self, text: &str) -> bool;

    /// Props whose values are encoded directly in the Markdown syntax.
    /// All other props on the node will be persisted in the hidden HTML comment.
    fn native_keys(&self) -> &'static [&'static str];

    /// Render props to a Markdown string.
    fn format(&self, props: &Props) -> String;

    /// Parse a Markdown string into props (native keys only).
    fn extract(&self, text: &str) -> Props;
}

/// A registry that routes Markdown text or kind identifiers to the correct
/// `BlockFormatter`. Backed by a process-wide static to avoid repeated allocation.
pub struct FormatterRegistry {
    formatters: Vec<Box<dyn BlockFormatter>>,
    fallback: Box<dyn BlockFormatter>,
}

impl FormatterRegistry {
    fn build() -> Self {
        let mut reg = Self {
            formatters: Vec::new(),
            fallback: Box::new(paragraph::ParagraphFormatter),
        };
        reg.formatters.push(Box::new(heading::HeadingFormatter));
        reg.formatters.push(Box::new(task::TaskFormatter));
        reg.formatters.push(Box::new(image::ImageFormatter));
        reg.formatters.push(Box::new(quote::QuoteFormatter));
        reg.formatters.push(Box::new(code_block::CodeBlockFormatter));
        reg.formatters.push(Box::new(divider::DividerFormatter));
        reg.formatters.push(Box::new(flashcard::FlashcardFormatter));
        reg
    }

    pub fn get_by_kind(&self, kind: &str) -> &dyn BlockFormatter {
        self.formatters
            .iter()
            .find(|f| f.kind() == kind)
            .map(|f| f.as_ref())
            .unwrap_or(self.fallback.as_ref())
    }

    pub fn get_by_text(&self, text: &str) -> &dyn BlockFormatter {
        self.formatters
            .iter()
            .find(|f| f.matches(text))
            .map(|f| f.as_ref())
            .unwrap_or(self.fallback.as_ref())
    }
}

/// Process-wide singleton. Avoids rebuilding the registry on every block
/// serialize/deserialize call.
pub static REGISTRY: Lazy<FormatterRegistry> = Lazy::new(FormatterRegistry::build);


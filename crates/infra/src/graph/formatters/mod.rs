pub mod block;
pub mod heading;
pub mod task;
pub mod image;
pub mod quote;
pub mod code_block;
pub mod divider;
pub mod paragraph;

use domain::value::Props;
use once_cell::sync::Lazy;

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

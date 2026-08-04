use chrono::{DateTime, NaiveDate, Utc};
use indexmap::IndexMap;
use smallvec::SmallVec;
use std::sync::Arc;

use crate::primitives::{NodeId, PropKey};

#[derive(Debug, Clone, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
pub struct Color(Arc<str>);

impl Color {
    pub fn new(s: &str) -> Self {
        Self(Arc::from(s))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Mark {
    Bold,
    Italic,
    Code,
    Strikethrough,
    Underline,
    Link(Arc<str>),
    Color(Color),
    Ref(NodeId),
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct Span {
    pub text: Arc<str>,
    pub marks: SmallVec<[Mark; 2]>,
}

impl Span {
    pub fn plain(text: &str) -> Self {
        Self {
            text: Arc::from(text),
            marks: SmallVec::new(),
        }
    }

    pub fn with_marks(text: &str, marks: impl Into<SmallVec<[Mark; 2]>>) -> Self {
        Self {
            text: Arc::from(text),
            marks: marks.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Default, serde::Serialize, serde::Deserialize)]
pub struct RichText(pub Vec<Span>);

impl RichText {
    pub fn new() -> Self {
        Self(Vec::new())
    }

    pub fn plain(text: &str) -> Self {
        Self(vec![Span::plain(text)])
    }

    pub fn push(&mut self, span: Span) {
        self.0.push(span);
    }

    pub fn to_plain_text(&self) -> String {
        self.0.iter().map(|s| s.text.as_ref()).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Value {
    Null,
    Bool(bool),
    Int(i64),

    Float(FloatBits),

    Text(Arc<str>),

    Rich(RichText),

    Ref(NodeId),
    Array(Vec<Value>),
    Date(NaiveDate),
    DateTime(DateTime<Utc>),
    Color(Color),
}

#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct FloatBits(pub f64);

impl PartialEq for FloatBits {
    fn eq(&self, other: &Self) -> bool {
        self.0.to_bits() == other.0.to_bits()
    }
}

impl Eq for FloatBits {}

impl Value {
    pub fn float(f: f64) -> Self {
        Self::Float(FloatBits(f))
    }

    pub fn text(s: &str) -> Self {
        Self::Text(Arc::from(s))
    }

    pub fn as_text(&self) -> Option<&str> {
        match self {
            Self::Text(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self {
            Self::Bool(b) => Some(*b),
            _ => None,
        }
    }

    pub fn as_int(&self) -> Option<i64> {
        match self {
            Self::Int(i) => Some(*i),
            _ => None,
        }
    }

    pub fn as_ref_id(&self) -> Option<NodeId> {
        match self {
            Self::Ref(id) => Some(*id),
            _ => None,
        }
    }

    pub fn as_rich(&self) -> Option<&RichText> {
        match self {
            Self::Rich(rt) => Some(rt),
            _ => None,
        }
    }

    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }

    pub fn collect_refs(&self, out: &mut Vec<NodeId>) {
        match self {
            Self::Ref(id) => out.push(*id),
            Self::Text(text) => {
                extract_uuids_from_text(text, out);
            }
            Self::Array(values) => {
                for v in values {
                    v.collect_refs(out);
                }
            }
            Self::Rich(rt) => {
                for span in &rt.0 {
                    for mark in &span.marks {
                        if let Mark::Ref(id) = mark {
                            out.push(*id);
                        }
                    }
                }
            }
            _ => {}
        }
    }
}

fn extract_uuids_from_text(text: &str, out: &mut Vec<NodeId>) {
    let bytes = text.as_bytes();
    let len = bytes.len();
    if len < 36 {
        return;
    }
    for i in 0..=len - 36 {
        if bytes[i + 8] == b'-'
            && bytes[i + 13] == b'-'
            && bytes[i + 18] == b'-'
            && bytes[i + 23] == b'-'
            && let Ok(uuid) = uuid::Uuid::parse_str(&text[i..i + 36])
        {
            let node_id = NodeId::from_uuid(uuid);
            if !out.contains(&node_id) {
                out.push(node_id);
            }
        }
    }
}

pub type Props = IndexMap<PropKey, Value>;

#[macro_export]
macro_rules! props {
    ($($key:expr => $val:expr),* $(,)?) => {{
        let mut map = $crate::value::Props::new();
        $(
            map.insert($crate::primitives::PropKey::from($key), $val);
        )*
        map
    }};
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_inline_refs_from_text() {
        let id1 = NodeId::new();
        let id2 = NodeId::new();
        let text = format!("Check this note [[{}]] and image ![{}]({})", id1, id2, id2);

        let val = Value::Text(std::sync::Arc::from(text.as_str()));
        let mut refs = Vec::new();
        val.collect_refs(&mut refs);

        assert_eq!(refs.len(), 2);
        assert!(refs.contains(&id1));
        assert!(refs.contains(&id2));
    }
}

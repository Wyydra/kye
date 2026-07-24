use chrono::{DateTime, NaiveDate, Utc};
use indexmap::IndexMap;
use smallvec::SmallVec;
use std::sync::Arc;

use crate::primitives::{NodeId, PropKey};

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Color(Arc<str>);

impl Color {
    pub fn new(s: &str) -> Self {
        Self(Arc::from(s))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, PartialEq, Eq, Default)]
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

#[derive(Debug, Clone, PartialEq, Eq)]
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

#[derive(Debug, Clone, Copy)]
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

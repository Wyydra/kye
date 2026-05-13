//! Valeurs du domaine — tout ce qu'une propriété peut contenir.

use std::sync::Arc;
use smallvec::SmallVec;
use indexmap::IndexMap;
use chrono::{DateTime, NaiveDate, Utc};

use crate::primitives::{NodeId, PropKey};

// ── Color ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct Color(Arc<str>); // e.g. "#FF5733" ou "red"

impl Color {
    pub fn new(s: &str) -> Self {
        Self(Arc::from(s))
    }
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

// ── RichText ──────────────────────────────────────────────────────────────────

/// Formatage inline d'un span de texte.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Mark {
    Bold,
    Italic,
    Code,
    Strikethrough,
    Underline,
    Link(Arc<str>),     // URL cible
    Color(Color),
    Ref(NodeId),        // mention d'un node
}

/// Span de texte avec ses marques. `SmallVec<[Mark; 2]>` — la plupart des spans
/// ont 0, 1 ou 2 marques → zéro allocation heap dans le cas courant.
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

/// Liste plate de spans — modèle ProseMirror-like.
/// Suffisant pour le formatting inline ; les blocs sont des nodes enfants.
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

    /// Texte brut, marques ignorées — utile pour les previews.
    pub fn to_plain_text(&self) -> String {
        self.0.iter().map(|s| s.text.as_ref()).collect()
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

// ── Value ─────────────────────────────────────────────────────────────────────

/// Union de toutes les données possibles dans une propriété.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Value {
    Null,
    Bool(bool),
    Int(i64),
    /// Float avec `Eq` via `to_bits()` — pas de dépendance `ordered_float`.
    Float(FloatBits),
    /// Texte machine : titre, url, lang, code… Pas de formatting.
    Text(Arc<str>),
    /// Contenu éditable avec formatting inline.
    Rich(RichText),
    /// Lien vers un autre node — alimente le backlink index du Graph.
    Ref(NodeId),
    Array(Vec<Value>),
    Date(NaiveDate),
    DateTime(DateTime<Utc>),
    Color(Color),
}

/// `f64` wrappé pour implémenter `Eq` via `to_bits()`.
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

    /// Collect all NodeId refs embedded in this value (pour le backlink index).
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

// ── Props ─────────────────────────────────────────────────────────────────────

/// Map ordonnée de propriétés. Ordre d'insertion = ordre d'affichage dans l'UI.
pub type Props = IndexMap<PropKey, Value>;

/// Macro sucre syntaxique pour créer une `Props` lisiblement.
///
/// Voir `lib.rs` pour les re-exports nécessaires à l'utilisation.
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

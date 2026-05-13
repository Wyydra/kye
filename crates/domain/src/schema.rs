//! KindDef — contrat d'un Kind : props attendues, contraintes, rendu par défaut.

use indexmap::IndexMap;

use crate::primitives::{Kind, PropKey};
use crate::view::ViewDef;

// ── Erreurs de validation ─────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValidationError {
    MissingRequiredProp(PropKey),
    WrongType { prop: PropKey, expected: ValueType },
    ConstraintViolation(String),
}

impl std::fmt::Display for ValidationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::MissingRequiredProp(k) => write!(f, "Missing required prop: {}", k),
            Self::WrongType { prop, expected } => write!(f, "Wrong type for {}: expected {:?}", prop, expected),
            Self::ConstraintViolation(msg) => write!(f, "Constraint violation: {}", msg),
        }
    }
}

// ── ValueType ─────────────────────────────────────────────────────────────────

/// Type attendu pour une prop dans un KindDef.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ValueType {
    Bool,
    Int,
    Float,
    Text,
    Rich,
    Ref,
    /// Ref vers un node d'un Kind spécifique.
    RefTo(Kind),
    /// Une valeur parmi un ensemble de strings.
    OneOf(Vec<String>),
    Array(Box<ValueType>),
    Optional(Box<ValueType>),
    Date,
    DateTime,
    Color,
}

// ── PropDef ───────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct PropDef {
    pub value_type: ValueType,
    pub required: bool,
    pub label: Option<String>,
    pub description: Option<String>,
}

impl PropDef {
    pub fn new(value_type: ValueType) -> Self {
        Self { value_type, required: true, label: None, description: None }
    }

    pub fn optional(mut self) -> Self {
        self.required = false;
        self
    }

    pub fn with_label(mut self, label: &str) -> Self {
        self.label = Some(label.to_string());
        self
    }

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = Some(desc.to_string());
        self
    }
}

// ── Constraint ────────────────────────────────────────────────────────────────

/// Règles structurelles d'un Kind.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Constraint {
    /// Seuls ces Kinds sont autorisés comme enfants.
    AllowedChildKinds(Vec<Kind>),
    /// Seuls ces Kinds peuvent être le parent.
    AllowedParentKinds(Vec<Kind>),
    /// Pour les connections : kinds autorisés comme source.
    ConnectionSourceKinds(Vec<Kind>),
    /// Pour les connections : kinds autorisés comme cible.
    ConnectionTargetKinds(Vec<Kind>),
    /// Nombre maximum d'enfants.
    MaxChildren(usize),
}

// ── KindDef ───────────────────────────────────────────────────────────────────

/// Contrat complet d'un Kind.
#[derive(Debug, Clone)]
pub struct KindDef {
    /// Label affiché dans l'UI.
    pub label: String,
    /// Icône (nom ou emoji).
    pub icon: Option<String>,
    /// Quelle prop afficher comme titre dans les listes.
    pub title_prop: PropKey,
    /// Props dans l'ordre d'affichage.
    pub props: IndexMap<PropKey, PropDef>,
    /// Vue par défaut pour ce kind.
    pub view: Option<ViewDef>,
    /// Contraintes structurelles.
    pub constraints: Vec<Constraint>,
}

impl KindDef {
    pub fn new(label: &str, title_prop: impl Into<PropKey>) -> Self {
        Self {
            label: label.to_string(),
            icon: None,
            title_prop: title_prop.into(),
            props: IndexMap::new(),
            view: None,
            constraints: Vec::new(),
        }
    }

    pub fn with_icon(mut self, icon: &str) -> Self {
        self.icon = Some(icon.to_string());
        self
    }

    pub fn with_prop(mut self, key: impl Into<PropKey>, def: PropDef) -> Self {
        self.props.insert(key.into(), def);
        self
    }

    pub fn with_view(mut self, view: ViewDef) -> Self {
        self.view = Some(view);
        self
    }

    pub fn with_constraint(mut self, constraint: Constraint) -> Self {
        self.constraints.push(constraint);
        self
    }
}

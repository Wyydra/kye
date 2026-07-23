

use std::fmt;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
pub struct NodeId(Uuid);


impl NodeId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }

    pub fn from_uuid(uuid: Uuid) -> Self {
        Self(uuid)
    }

    pub fn as_uuid(&self) -> Uuid {
        self.0
    }
}

impl Default for NodeId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for NodeId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Kind(Arc<str>);

impl Kind {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for Kind {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for Kind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct PropKey(Arc<str>);

impl PropKey {
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl<S: AsRef<str>> From<S> for PropKey {
    fn from(s: S) -> Self {
        Self(Arc::from(s.as_ref()))
    }
}

impl fmt::Display for PropKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}

pub mod kinds {
    use super::Kind;

    pub fn page() -> Kind { Kind::from("core.page") }
    pub fn paragraph() -> Kind { Kind::from("core.paragraph") }
    pub fn heading() -> Kind { Kind::from("core.heading") }
    pub fn task() -> Kind { Kind::from("core.task") }
    pub fn image() -> Kind { Kind::from("core.image") }
    pub fn code_block() -> Kind { Kind::from("core.code_block") }
    pub fn quote() -> Kind { Kind::from("core.quote") }
    pub fn divider() -> Kind { Kind::from("core.divider") }
    pub fn callout() -> Kind { Kind::from("core.callout") }
    pub fn embed() -> Kind { Kind::from("core.embed") }
    pub fn file() -> Kind { Kind::from("file") }
    pub fn asset() -> Kind { Kind::from("asset") }


    pub fn flashcard() -> Kind { Kind::from("core.flashcard") }
    pub fn form() -> Kind { Kind::from("core.form") }
    pub fn form_field() -> Kind { Kind::from("core.form_field") }

    pub fn database() -> Kind { Kind::from("core.database") }
    pub fn row() -> Kind { Kind::from("core.row") }
    pub fn column() -> Kind { Kind::from("core.column") }
    pub fn query() -> Kind { Kind::from("core.query") }

    pub fn canvas() -> Kind { Kind::from("core.canvas") }
    pub fn frame() -> Kind { Kind::from("core.frame") }
    pub fn connection() -> Kind { Kind::from("core.connection") }

    pub fn inbox() -> Kind { Kind::from("core.inbox") }

    pub fn state() -> Kind { Kind::from("mbse.state") }
    pub fn port() -> Kind { Kind::from("mbse.port") }
    pub fn transition() -> Kind { Kind::from("mbse.transition") }
    pub fn component() -> Kind { Kind::from("mbse.component") }
    pub fn requirement() -> Kind { Kind::from("mbse.requirement") }
    pub fn interface() -> Kind { Kind::from("mbse.interface") }
}

pub mod props {
    use super::PropKey;

    pub fn title() -> PropKey { PropKey::from("title") }
    pub fn checked() -> PropKey { PropKey::from("checked") }
    pub fn body() -> PropKey { PropKey::from("body") }
    pub fn url() -> PropKey { PropKey::from("url") }
    pub fn lang() -> PropKey { PropKey::from("lang") }
    pub fn level() -> PropKey { PropKey::from("level") }
    pub fn icon() -> PropKey { PropKey::from("icon") }
    pub fn color() -> PropKey { PropKey::from("color") }
    pub fn from() -> PropKey { PropKey::from("from") }
    pub fn to() -> PropKey { PropKey::from("to") }
    pub fn tag() -> PropKey { PropKey::from("tag") }
    pub fn kind_filter() -> PropKey { PropKey::from("kind_filter") }
    pub fn tag_filter() -> PropKey { PropKey::from("tag_filter") }
    pub fn limit() -> PropKey { PropKey::from("limit") }
    pub fn question() -> PropKey { PropKey::from("question") }
    pub fn answer() -> PropKey { PropKey::from("answer") }
    pub fn front() -> PropKey { PropKey::from("front") }
    pub fn back() -> PropKey { PropKey::from("back") }
}

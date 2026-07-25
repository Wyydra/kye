use serde::{Deserialize, Serialize};
use crate::command::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum DiffLineKind {
    #[serde(rename = "add")]
    Add,
    #[serde(rename = "remove")]
    Remove,
    #[serde(rename = "info")]
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiffLine {
    #[serde(rename = "type")]
    pub kind: DiffLineKind,
    pub text: String,
}

impl DiffLine {
    pub fn add(text: impl Into<String>) -> Self {
        Self {
            kind: DiffLineKind::Add,
            text: text.into(),
        }
    }

    pub fn remove(text: impl Into<String>) -> Self {
        Self {
            kind: DiffLineKind::Remove,
            text: text.into(),
        }
    }

    pub fn info(text: impl Into<String>) -> Self {
        Self {
            kind: DiffLineKind::Info,
            text: text.into(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReviewableCommand {
    pub id: String,
    pub selected: bool,
    pub description: String,
    #[serde(rename = "nodeTitle")]
    pub node_title: String,
    pub cmd: Command,
    #[serde(rename = "diffLines")]
    pub diff_lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct SyncDiff {
    #[serde(rename = "local")]
    pub local_changes: Vec<ReviewableCommand>,
    #[serde(rename = "remote")]
    pub remote_changes: Vec<ReviewableCommand>,
}

impl SyncDiff {
    pub fn is_empty(&self) -> bool {
        self.local_changes.is_empty() && self.remote_changes.is_empty()
    }
}

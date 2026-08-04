use std::collections::HashMap;
use uuid::Uuid;

use super::remote::{Remote, RemoteName, RemoteUrl};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceMeta {
    pub id: Uuid,
    pub name: String,
    pub default_remote: Option<RemoteName>,
    pub remotes: HashMap<RemoteName, RemoteUrl>,
}

impl WorkspaceMeta {
    pub fn new(id: Uuid, name: impl Into<String>) -> Self {
        Self {
            id,
            name: name.into(),
            default_remote: None,
            remotes: HashMap::new(),
        }
    }

    pub fn with_remotes(
        id: Uuid,
        name: impl Into<String>,
        default_remote: Option<RemoteName>,
        remotes: HashMap<RemoteName, RemoteUrl>,
    ) -> Self {
        Self {
            id,
            name: name.into(),
            default_remote,
            remotes,
        }
    }

    pub fn add_remote(&mut self, name: RemoteName, url: RemoteUrl) {
        if self.default_remote.is_none() || self.remotes.is_empty() {
            self.default_remote = Some(name.clone());
        }
        self.remotes.insert(name, url);
    }

    pub fn remove_remote(&mut self, name: &RemoteName) -> bool {
        let removed = self.remotes.remove(name).is_some();
        if removed && self.default_remote.as_ref() == Some(name) {
            self.default_remote = self.remotes.keys().next().cloned();
        }
        removed
    }

    pub fn set_default_remote(&mut self, name: RemoteName) -> Result<(), String> {
        if !self.remotes.contains_key(&name) {
            return Err(format!("Remote '{}' does not exist in workspace", name));
        }
        self.default_remote = Some(name);
        Ok(())
    }

    pub fn get_remote(&self, name: Option<&RemoteName>) -> Option<Remote> {
        let target_name = name.or(self.default_remote.as_ref())?;
        let url = self.remotes.get(target_name)?;
        Some(Remote::new(target_name.clone(), url.clone()))
    }

    pub fn list_remotes(&self) -> Vec<Remote> {
        let mut list: Vec<Remote> = self
            .remotes
            .iter()
            .map(|(k, v)| Remote::new(k.clone(), v.clone()))
            .collect();
        list.sort_by(|a, b| a.name.as_str().cmp(b.name.as_str()));
        list
    }
}

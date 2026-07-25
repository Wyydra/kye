use serde::{Deserialize, Serialize};
use std::fmt;
use thiserror::Error;

#[derive(Debug, Clone, Error, PartialEq, Eq)]
pub enum RemoteError {
    #[error("Invalid remote name '{0}': name cannot be empty, must be <= 64 chars, and contain only alphanumeric, hyphen or underscore characters")]
    InvalidName(String),
    #[error("Invalid remote URL '{0}': URL must start with http:// or https:// and be a valid web address")]
    InvalidUrl(String),
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RemoteName(String);

impl RemoteName {
    pub fn new(name: impl AsRef<str>) -> Result<Self, RemoteError> {
        let s = name.as_ref().trim();
        if s.is_empty() || s.len() > 64 {
            return Err(RemoteError::InvalidName(s.to_string()));
        }
        if !s.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
            return Err(RemoteError::InvalidName(s.to_string()));
        }
        Ok(Self(s.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RemoteName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl TryFrom<&str> for RemoteName {
    type Error = RemoteError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl TryFrom<String> for RemoteName {
    type Error = RemoteError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct RemoteUrl(String);

impl RemoteUrl {
    pub fn new(url: impl AsRef<str>) -> Result<Self, RemoteError> {
        let s = url.as_ref().trim();
        let trimmed_url = s.trim_end_matches('/');
        if !trimmed_url.starts_with("http://") && !trimmed_url.starts_with("https://") {
            return Err(RemoteError::InvalidUrl(s.to_string()));
        }
        if trimmed_url.len() < 10 {
            return Err(RemoteError::InvalidUrl(s.to_string()));
        }
        Ok(Self(trimmed_url.to_string()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for RemoteUrl {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl TryFrom<&str> for RemoteUrl {
    type Error = RemoteError;

    fn try_from(value: &str) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

impl TryFrom<String> for RemoteUrl {
    type Error = RemoteError;

    fn try_from(value: String) -> Result<Self, Self::Error> {
        Self::new(value)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Remote {
    pub name: RemoteName,
    pub url: RemoteUrl,
}

impl Remote {
    pub fn new(name: RemoteName, url: RemoteUrl) -> Self {
        Self { name, url }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_remote_name() {
        let name = RemoteName::new("origin").unwrap();
        assert_eq!(name.as_str(), "origin");

        let name2 = RemoteName::new("my-vps_1").unwrap();
        assert_eq!(name2.as_str(), "my-vps_1");
    }

    #[test]
    fn test_invalid_remote_name() {
        assert!(RemoteName::new("").is_err());
        assert!(RemoteName::new("invalid name!").is_err());
        assert!(RemoteName::new("a".repeat(65)).is_err());
    }

    #[test]
    fn test_valid_remote_url() {
        let url = RemoteUrl::new("http://192.168.1.50:7272/").unwrap();
        assert_eq!(url.as_str(), "http://192.168.1.50:7272");

        let url2 = RemoteUrl::new("https://kye.example.com").unwrap();
        assert_eq!(url2.as_str(), "https://kye.example.com");
    }

    #[test]
    fn test_invalid_remote_url() {
        assert!(RemoteUrl::new("ftp://server").is_err());
        assert!(RemoteUrl::new("http://").is_err());
    }
}

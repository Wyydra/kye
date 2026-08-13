use std::path::{Path, PathBuf};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use std::process::Command;

use domain::ports::{RepositoryError, SystemShellPort};

pub struct DesktopSystemShell {
    root: PathBuf,
}

impl DesktopSystemShell {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }
}

impl SystemShellPort for DesktopSystemShell {
    fn open_external(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.root.join(target_path_str)
        };

        if !abs_path.exists() {
            return Err(RepositoryError::NotFound(format!(
                "Target file for external open does not exist: {}",
                abs_path.display()
            )));
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "", &abs_path.to_string_lossy()])
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to open file: {}", e)))?;
        }

        Ok(())
    }

    fn reveal_in_explorer(&self, target_path_str: &str) -> Result<(), RepositoryError> {
        let abs_path = if Path::new(target_path_str).is_absolute() {
            PathBuf::from(target_path_str)
        } else {
            self.root.join(target_path_str)
        };

        let _parent_dir = abs_path.parent().unwrap_or(&self.root);

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(_parent_dir)
                .spawn()
                .map_err(|e| {
                    RepositoryError::Io(format!("Failed to open directory in file manager: {}", e))
                })?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg("-R")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| RepositoryError::Io(format!("Failed to reveal file: {}", e)))?;
        }

        #[cfg(target_os = "windows")]
        {
            Command::new("explorer")
                .arg("/select,")
                .arg(&abs_path)
                .spawn()
                .map_err(|e| {
                    RepositoryError::Io(format!("Failed to reveal file in explorer: {}", e))
                })?;
        }

        Ok(())
    }
}

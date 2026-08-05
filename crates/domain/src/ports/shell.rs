use crate::ports::RepositoryError;

pub trait SystemShellPort: Send + Sync + 'static {
    fn open_external(&self, target_path: &str) -> Result<(), RepositoryError>;
    fn reveal_in_explorer(&self, target_path: &str) -> Result<(), RepositoryError>;
}

impl SystemShellPort for () {
    fn open_external(&self, _target_path: &str) -> Result<(), RepositoryError> {
        Ok(())
    }
    fn reveal_in_explorer(&self, _target_path: &str) -> Result<(), RepositoryError> {
        Ok(())
    }
}

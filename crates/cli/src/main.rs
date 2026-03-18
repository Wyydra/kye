use domain::models::block::{Content, CreateBlockRequest, Metadata};
use domain::ports::WorkspaceRepository;
use infra::markdown::MarkdownWorkspaceRepository;

fn main() {
    let repo = MarkdownWorkspaceRepository::new(std::path::PathBuf::from("test"));
    let content = Content::new("Hello");
    let metadata = Metadata::new("World!");
    let req = CreateBlockRequest::new(content, metadata);
    let block = repo.create_block(&req); // TODO: ici on utilise pas que le service normalement
}

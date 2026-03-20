use domain::models::block::{Content, CreateBlockRequest, Metadata};
use domain::ports::BlockService;
use domain::service::Service;
use infra::markdown::DirectoryWorkspaceRepository;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. On donne au Repo le chemin vers notre dossier de test ("test_workspace")
    let repo = DirectoryWorkspaceRepository::new(std::path::PathBuf::from("test_workspace"));
    
    // 2. On instancie notre Service (stateless) avec ce Repository
    let service = Service::new(repo);
    
    // 3. (CQRS - Query) Demander au Service de lire tout le dossier
    // Attention: Ça va planter pour l'instant car load_workspace() a un todo!()
    println!("--- Chargement du Workspace ---");
    let workspace = service.get_workspace().await?;
    println!("Workspace '{}' chargé ! (Il contient {} blocs)", workspace.name(), workspace.blocks().len());

    // 4. (CQRS - Command) Demander au Service de créer un Bloc
    println!("\n--- Création d'un Bloc ---");
    let content = Content::new("Du texte...");
    let metadata = Metadata::new(r#"{"type": "standard"}"#);
    let req = CreateBlockRequest::new(content, metadata);
    
    let block = service.create_block(&req).await?;
    println!("Bloc ajouté avec succès : {:?}", block);
    
    Ok(())
}

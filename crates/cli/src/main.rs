use std::path::PathBuf;
use clap::{Parser, Subcommand};
use domain::models::block::{
    Content, CreateBlockRequest, UpdateBlockRequest,
};
use domain::ports::{WorkspaceUseCase, TypeInspector};
use domain::service::Service;
use uuid::Uuid;
use infra::markdown::DirectoryWorkspaceRepository;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    #[arg(short, long, default_value = "test_workspace")]
    workspace: PathBuf,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Add a new block to the workspace
    Add {
        /// The content of the block
        #[arg(short, long)]
        content: String,

        /// The type of the block (e.g., text, image, port)
        #[arg(short, long, default_value = "text")]
        type_name: String,
    },
    /// List available block types
    Types,
    /// List all blocks in the workspace
    List,
    /// Update a block's content
    Update {
        /// The ID of the block to update
        #[arg(short, long)]
        id: Uuid,
        /// The new content
        #[arg(short, long)]
        content: String,
    },
    /// Show a block's details
    Show {
        /// The ID of the block to show
        #[arg(short, long)]
        id: Uuid,
    },
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let cli = Cli::parse();
    let repo = DirectoryWorkspaceRepository::new(cli.workspace.clone());
    let service = Service::new(repo, ()); // Le Unit type `()` implémente EventDispatcher no-op

    match cli.command {
        Commands::Add { content, type_name } => {
            if service.get_type_definition(&type_name).is_none() {
                anyhow::bail!("Unknown block type: {}", type_name);
            }

            // Construct metadata with the requested type
            let metadata_json = format!(r#"{{"type": "{}"}}"#, type_name);
            let metadata_provider = infra::metadata::JsonMetadataProvider(metadata_json);
            let fields = metadata_provider.get_fields().unwrap_or_else(|e| {
                tracing::error!("Metadata error: {}", e);
                domain::models::block::metadata::Fields::new()
            });
            let req = CreateBlockRequest::new(Content::new(&content), fields);
            let (_workspace, block_id) = service.create_block(&req).await?;

            println!("Successfully created block {} of type '{}'", block_id, type_name);
        }
        Commands::Types => {
            println!("Available block types:");
            for name in service.get_block_types() {
                println!("- {}", name);
            }
        }
        Commands::List => {
            let workspace = service.get_workspace().await?;
            println!("Blocks in workspace '{}' ({}):", workspace.name(), workspace.id());
            for block in workspace.blocks() {
                let content_preview = block.content().to_string();
                let preview = if content_preview.len() > 50 {
                    format!("{}...", &content_preview[..47])
                } else {
                    content_preview
                };
                println!("{}: {}", block.id(), preview);
            }
        }
        Commands::Update { id, content } => {
            let req = UpdateBlockRequest::new(id, Some(Content::new(&content)), None);
            service.update_block(&req).await?;
            println!("Successfully updated block {}", id);
        }
        Commands::Show { id } => {
            let workspace = service.get_workspace().await?;
            if let Some(block) = workspace.blocks().iter().find(|b| *b.id() == id) {
                println!("Block ID: {}", block.id());
                println!("Content:\n{}", block.content());
                println!("Metadata: {}", block.metadata());
            } else {
                anyhow::bail!("Block {} not found", id);
            }
        }
    }

    Ok(())
}

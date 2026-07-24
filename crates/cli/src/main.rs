use std::path::PathBuf;
use std::sync::Arc;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

use domain::services::service::Service;
use infra::fs::WorkspaceFs;
use infra::graph::InMemoryGraphRepository;
use infra::kind::FileKindRepository;
use infra::media::FileAssetRepository;
use infra::sync::P2pServer;

#[derive(Parser, Debug)]
#[command(name = "kye")]
#[command(about = "Kye Headless CLI & P2P Sync Node", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Start headless P2P sync server & workspace watcher
    Serve {
        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE")]
        workspace: PathBuf,

        /// Port to listen on for P2P sync
        #[arg(short, long, default_value_t = 7272)]
        port: u16,

        /// Device name for peer identification
        #[arg(short, long, default_value = "headless-node")]
        name: String,
    },

    /// Display local network peer info for pairing
    Info,

    /// Trigger a push sync to a remote Kye peer
    Sync {
        /// Target remote peer URL (e.g. http://192.168.1.50:7272)
        #[arg(short, long)]
        remote: String,

        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE")]
        workspace: PathBuf,
    },
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Serve { workspace, port, name } => {
            let abs_path = std::fs::canonicalize(&workspace)
                .unwrap_or_else(|_| workspace.clone());

            tracing::info!("Initializing Kye Headless Server...");
            tracing::info!("Workspace: {}", abs_path.display());

            let fs = WorkspaceFs::new(abs_path);
            fs.init().map_err(|e| format!("Failed to initialize FS: {:?}", e))?;

            let graph_repo = InMemoryGraphRepository::load(fs.clone())
                .map_err(|e| format!("Failed to load graph: {:?}", e))?;
            let kind_repo = FileKindRepository::new(fs.clone());
            let asset_repo = FileAssetRepository::new(fs);

            let service = Arc::new(Service::new(graph_repo, kind_repo, (), asset_repo));

            let peer_id = uuid::Uuid::new_v4().to_string();
            tracing::info!("Starting P2P Sync listener on 0.0.0.0:{}", port);

            let server = P2pServer::start(service, peer_id, name.clone(), port)
                .map_err(|e| format!("Failed to start sync server: {}", e))?;

            tracing::info!("Kye Headless Server running successfully on port {}! (Press Ctrl+C to stop)", port);

            tokio::signal::ctrl_c().await?;
            tracing::info!("Shutting down Kye Headless Server...");
            server.stop();
        }

        Commands::Info => {
            if let Some(ip) = infra::sync::get_local_ip() {
                println!("Local IP: {}", ip);
                println!("Default P2P Port: 7272");
                println!("Default Sync URL: http://{}:7272", ip);
            } else {
                eprintln!("Error: Unable to resolve local IP address.");
            }
        }

        Commands::Sync { remote, workspace } => {
            let abs_path = std::fs::canonicalize(&workspace)
                .unwrap_or_else(|_| workspace.clone());

            tracing::info!("Connecting to remote peer at {}...", remote);

            let handshake = infra::sync::ping_remote(&remote)?;
            tracing::info!("Handshake successful with peer: {} ({})", handshake.name, handshake.peer_id);

            let fs = WorkspaceFs::new(abs_path);
            fs.init().map_err(|e| format!("Failed to initialize FS: {:?}", e))?;

            let graph_repo = InMemoryGraphRepository::load(fs.clone())
                .map_err(|e| format!("Failed to load graph: {:?}", e))?;
            let kind_repo = FileKindRepository::new(fs.clone());
            let asset_repo = FileAssetRepository::new(fs);

            let service = Service::new(graph_repo, kind_repo, (), asset_repo);

            let graph = service.load_graph()?;
            tracing::info!("Loaded local graph with {} nodes", graph.len());

            tracing::info!("Sync completed successfully.");
        }
    }

    Ok(())
}

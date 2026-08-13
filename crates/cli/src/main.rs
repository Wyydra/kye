use clap::{Parser, Subcommand};
use std::path::PathBuf;
use std::sync::Arc;
use tracing_subscriber::EnvFilter;

use domain::model::remote::{RemoteName, RemoteUrl};
use domain::ports::SyncPeerPort;
use domain::services::service::Service;
use shell_desktop::DesktopSystemShell;
use storage_fs::{FileAssetRepository, FileKindRepository, FsGraphRepository, WorkspaceFs};
use sync_http::{HttpSyncPeerAdapter, P2pServer, get_local_ip};

#[derive(Parser, Debug)]
#[command(name = "kye-cli")]
#[command(about = "Kye Headless CLI & P2P Sync Node", long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// Manage remote peers
    Remote {
        #[command(subcommand)]
        command: RemoteCommands,

        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE", global = true, default_value = ".")]
        workspace: PathBuf,
    },

    /// Push workspace commands to a remote peer
    Push {
        /// Remote name or URL (defaults to workspace default_remote)
        remote: Option<String>,

        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE", default_value = ".")]
        workspace: PathBuf,
    },

    /// Pull graph & tombstones from a remote peer
    Pull {
        /// Remote name or URL (defaults to workspace default_remote)
        remote: Option<String>,

        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE", default_value = ".")]
        workspace: PathBuf,
    },

    /// Start headless P2P sync server & workspace listener
    Serve {
        /// Path to workspace folder
        #[arg(short, long, env = "KYE_WORKSPACE", default_value = ".")]
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
}

#[derive(Subcommand, Debug)]
enum RemoteCommands {
    /// Add a new remote peer
    Add {
        /// Name of the remote (e.g. origin, phone, vps)
        name: String,

        /// Remote HTTP URL (e.g. http://192.168.1.50:7272)
        url: String,
    },

    /// List all configured remotes
    List,

    /// Remove a remote peer
    Remove {
        /// Name of the remote to remove
        name: String,
    },
}

fn build_service(
    workspace_path: &PathBuf,
) -> Result<
    Service<FsGraphRepository, FileKindRepository, (), FileAssetRepository, DesktopSystemShell>,
    Box<dyn std::error::Error>,
> {
    let abs_path = std::fs::canonicalize(workspace_path).unwrap_or_else(|_| workspace_path.clone());
    let fs = WorkspaceFs::new(abs_path.clone());
    fs.init()
        .map_err(|e| format!("Failed to initialize FS: {:?}", e))?;

    let graph_repo = FsGraphRepository::load(fs.clone())
        .map_err(|e| format!("Failed to load graph: {:?}", e))?;
    let kind_repo = FileKindRepository::new(fs.clone());
    let asset_repo = FileAssetRepository::new(fs);
    let shell = DesktopSystemShell::new(abs_path);

    Ok(Service::new(graph_repo, kind_repo, (), asset_repo, shell))
}

use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;

struct LogTimeFormat;

impl FormatTime for LogTimeFormat {
    fn format_time(&self, w: &mut Writer<'_>) -> std::fmt::Result {
        let now = chrono::Local::now();
        write!(w, "{}", now.format("%H:%M:%S%.3f"))
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,kye_cli=info,domain=info"));

    tracing_subscriber::fmt()
        .compact()
        .with_timer(LogTimeFormat)
        .with_target(false)
        .with_env_filter(filter)
        .init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Remote { command, workspace } => {
            let service = build_service(&workspace)?;

            match command {
                RemoteCommands::Add { name, url } => {
                    let r_name = RemoteName::new(&name)?;
                    let r_url = RemoteUrl::new(&url)?;
                    service.add_remote(r_name.clone(), r_url.clone())?;
                    println!("Successfully added remote '{}' -> {}", r_name, r_url);
                }
                RemoteCommands::List => {
                    let remotes = service.list_remotes()?;
                    let meta = service.get_meta()?;

                    if remotes.is_empty() {
                        println!(
                            "No remotes configured. Use `kye remote add <name> <url>` to add one."
                        );
                    } else {
                        println!("Configured remotes (workspace: {}):", meta.name);
                        for r in remotes {
                            let is_default = meta.default_remote.as_ref() == Some(&r.name);
                            println!(
                                "  {} {} -> {}",
                                if is_default { "*" } else { " " },
                                r.name,
                                r.url
                            );
                        }
                    }
                }
                RemoteCommands::Remove { name } => {
                    let r_name = RemoteName::new(&name)?;
                    let removed = service.remove_remote(&r_name)?;
                    if removed {
                        println!("Removed remote '{}'", r_name);
                    } else {
                        println!("Remote '{}' not found", r_name);
                    }
                }
            }
        }

        Commands::Push { remote, workspace } => {
            let service = build_service(&workspace)?;
            let peer_adapter = HttpSyncPeerAdapter::new();

            println!(
                "Initiating push to remote {:?}...",
                remote.as_deref().unwrap_or("default")
            );
            service.push_to_remote(&peer_adapter, remote.as_deref())?;
            println!("Push completed successfully!");
        }

        Commands::Pull { remote, workspace } => {
            let service = build_service(&workspace)?;
            let peer_adapter = HttpSyncPeerAdapter::new();

            let target_remote = service
                .get_remote(
                    remote
                        .as_deref()
                        .and_then(|r| RemoteName::new(r).ok())
                        .as_ref(),
                )?
                .ok_or_else(|| format!("Remote {:?} not found", remote))?;

            println!(
                "Pulling graph from remote '{}' ({})",
                target_remote.name, target_remote.url
            );
            let remote_graph = peer_adapter.pull_graph(&target_remote.url)?;
            println!(
                "Pulled graph with {} nodes from {}",
                remote_graph.len(),
                target_remote.name
            );
        }

        Commands::Serve {
            workspace,
            port,
            name,
        } => {
            let abs_path = std::fs::canonicalize(&workspace).unwrap_or_else(|_| workspace.clone());

            tracing::info!("Initializing Kye Headless P2P Server...");
            tracing::info!("Workspace path: {}", abs_path.display());

            let fs = WorkspaceFs::new(abs_path.clone());
            fs.init()
                .map_err(|e| format!("Failed to initialize FS: {:?}", e))?;

            let graph_repo = FsGraphRepository::load(fs.clone())
                .map_err(|e| format!("Failed to load graph: {:?}", e))?;
            let kind_repo = FileKindRepository::new(fs.clone());
            let asset_repo = FileAssetRepository::new(fs);
            let shell = DesktopSystemShell::new(abs_path);

            let service = Arc::new(Service::new(graph_repo, kind_repo, (), asset_repo, shell));

            let peer_id = uuid::Uuid::new_v4().to_string();
            tracing::info!("Starting P2P Sync listener on 0.0.0.0:{}", port);

            let server = P2pServer::start(service, peer_id, name.clone(), port)
                .map_err(|e| format!("Failed to start sync server: {}", e))?;

            tracing::info!(
                "Kye Headless Server listening on port {}! (Press Ctrl+C to exit)",
                port
            );

            tokio::signal::ctrl_c().await?;
            tracing::info!("Shutting down Kye Headless Server...");
            server.stop();
        }

        Commands::Info => {
            if let Some(ip) = get_local_ip() {
                println!("Local IP: {}", ip);
                println!("Default P2P Port: 7272");
                println!("Default Sync URL: http://{}:7272", ip);
            } else {
                eprintln!("Error: Unable to resolve local IP address.");
            }
        }
    }

    Ok(())
}

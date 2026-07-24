#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;

fn print_help() {
    println!("Kye - Headless Sync Server");
    println!("Usage:");
    println!("  kye headless -w <workspace_path> [-p <port>]");
    println!("  kye --headless --workspace <workspace_path> [--port <port>]");
    println!();
    println!("Options:");
    println!("  -w, --workspace  Path to the workspace folder (required)");
    println!("  -p, --port       Port to run the sync server on (default: 8000)");
    println!("  -h, --help       Print this help message");
}

fn main() {
    let args: Vec<String> = std::env::args().collect();

    let is_headless = args
        .iter()
        .any(|arg| arg == "headless" || arg == "--headless");
    let wants_help = args.iter().any(|arg| arg == "-h" || arg == "--help");

    if wants_help && is_headless {
        print_help();
        return;
    }

    if is_headless {
        let mut workspace_path = None;
        let mut port = 8000;

        let mut i = 1;
        while i < args.len() {
            let arg = &args[i];
            if arg == "-w" || arg == "--workspace" {
                if i + 1 < args.len() {
                    workspace_path = Some(PathBuf::from(&args[i + 1]));
                    i += 2;
                    continue;
                } else {
                    eprintln!("Error: Missing value for --workspace option.");
                    print_help();
                    std::process::exit(1);
                }
            } else if arg == "-p" || arg == "--port" {
                if i + 1 < args.len() {
                    if let Ok(parsed_port) = args[i + 1].parse::<u16>() {
                        port = parsed_port;
                    } else {
                        eprintln!(
                            "Error: Invalid port value: '{}'. Must be a number between 1 and 65535.",
                            args[i + 1]
                        );
                        std::process::exit(1);
                    }
                    i += 2;
                    continue;
                } else {
                    eprintln!("Error: Missing value for --port option.");
                    print_help();
                    std::process::exit(1);
                }
            }
            i += 1;
        }

        let workspace = match workspace_path {
            Some(w) => w,
            None => {
                eprintln!("Error: Workspace path (-w, --workspace) is required in headless mode.");
                print_help();
                std::process::exit(1);
            }
        };

        if let Err(e) = kye_lib::run_headless(workspace, port) {
            eprintln!("Fatal error: {}", e);
            std::process::exit(1);
        }
    } else {
        kye_lib::run()
    }
}

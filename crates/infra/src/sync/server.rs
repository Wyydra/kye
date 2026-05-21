use std::sync::Arc;
use std::thread;
use std::sync::atomic::{AtomicBool, Ordering};
use tiny_http::{Server, Response, Header, Method};
use serde::{Serialize, Deserialize};

use domain::service::Service;
use domain::ports::{GraphRepository, KindRepository, EventBus, MediaRepository};
use domain::command::Command;
use crate::dto::{CommandDto, GraphDto};

#[derive(Serialize, Deserialize, Debug)]
pub struct HandshakeResponse {
    pub peer_id: String,
    pub name: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PushRequest {
    pub cmds: Vec<CommandDto>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct PushResponse {
    pub success: bool,
}

pub struct P2pServer {
    is_running: Arc<AtomicBool>,
    // Store the server instance so that dropping P2pServer will drop the server socket.
    _server: Arc<Server>,
}

impl P2pServer {
    pub fn start<R, K, E, M>(
        service: Arc<Service<R, K, E, M>>,
        peer_id: String,
        device_name: String,
        port: u16,
    ) -> Result<Self, String>
    where
        R: GraphRepository,
        K: KindRepository,
        E: EventBus,
        M: MediaRepository,
    {
        let server = Server::http(format!("0.0.0.0:{}", port))
            .map_err(|e| format!("Failed to start P2P server: {:?}", e))?;
        
        let server = Arc::new(server);
        let is_running = Arc::new(AtomicBool::new(true));
        
        let is_running_clone = is_running.clone();
        let server_clone = server.clone();
        
        thread::spawn(move || {
            let server = server_clone;
            while is_running_clone.load(Ordering::Relaxed) {
                let request = match server.recv() {
                    Ok(req) => req,
                    Err(_) => break,
                };
                
                if let Err(e) = handle_request(&service, &peer_id, &device_name, request) {
                    tracing::error!("P2P server error: {}", e);
                }
            }
        });
        
        Ok(Self { 
            is_running,
            _server: server,
        })
    }

    pub fn stop(&self) {
        self.is_running.store(false, Ordering::Relaxed);
    }
}

fn handle_request<R, K, E, M>(
    service: &Arc<Service<R, K, E, M>>,
    peer_id: &str,
    device_name: &str,
    mut request: tiny_http::Request,
) -> Result<(), String>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    M: MediaRepository,
{
    let url = request.url();
    let method = request.method();
    
    let response = match (method, url) {
        (&Method::Options, _) => {
            Response::from_string("")
                .with_status_code(200)
        }
        (&Method::Get, "/api/p2p/handshake") => {
            let data = HandshakeResponse {
                peer_id: peer_id.to_string(),
                name: device_name.to_string(),
            };
            let json = serde_json::to_string(&data).unwrap();
            Response::from_string(json)
                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                .with_status_code(200)
        }
        (&Method::Get, "/api/p2p/graph") => {
            match service.load_graph() {
                Ok(graph) => {
                    let dto = GraphDto::from(&graph);
                    let json = serde_json::to_string(&dto).unwrap();
                    Response::from_string(json)
                        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                        .with_status_code(200)
                }
                Err(e) => {
                    Response::from_string(format!("Failed to load graph: {:?}", e))
                        .with_status_code(500)
                }
            }
        }
        (&Method::Get, "/api/p2p/tombstones") => {
            match service.load_tombstones() {
                Ok(tombstones) => {
                    let mut map = std::collections::HashMap::new();
                    for (id, time) in tombstones {
                        map.insert(id.to_string(), time.to_rfc3339());
                    }
                    let json = serde_json::to_string(&map).unwrap();
                    Response::from_string(json)
                        .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                        .with_status_code(200)
                }
                Err(e) => {
                    Response::from_string(format!("Failed to load tombstones: {:?}", e))
                        .with_status_code(500)
                }
            }
        }
        (&Method::Post, "/api/p2p/push") => {
            let mut content = String::new();
            request.as_reader().read_to_string(&mut content)
                .map_err(|e| format!("Failed to read push body: {:?}", e))?;
            
            match serde_json::from_str::<PushRequest>(&content) {
                Ok(req) => {
                    let domain_cmds: Vec<Command> = req.cmds.into_iter().map(Command::from).collect();
                    match service.execute_batch(domain_cmds) {
                        Ok(_) => {
                            let resp = PushResponse { success: true };
                            let json = serde_json::to_string(&resp).unwrap();
                            Response::from_string(json)
                                .with_header(Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap())
                                .with_status_code(200)
                        }
                        Err(e) => {
                            Response::from_string(format!("Failed to execute batch: {:?}", e))
                                .with_status_code(500)
                        }
                    }
                }
                Err(e) => {
                    Response::from_string(format!("Invalid JSON payload: {:?}", e))
                        .with_status_code(400)
                }
            }
        }
        _ => {
            Response::from_string("Not Found")
                .with_status_code(404)
        }
    };
    
    // Set CORS headers
    let response = response
        .with_header(Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap())
        .with_header(Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap())
        .with_header(Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap());
        
    request.respond(response)
        .map_err(|e| format!("Failed to respond: {:?}", e))?;
        
    Ok(())
}

use std::net::UdpSocket;

pub mod client;
pub mod http_peer;
pub mod qrcode;
pub mod server;

pub use client::{
    ping_remote, pull_graph_from_remote, pull_tombstones_from_remote, push_to_remote,
};
pub use http_peer::HttpSyncPeerAdapter;
pub use qrcode::generate_qr_svg;
pub use server::P2pServer;

pub fn get_local_ip() -> Option<String> {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|socket| {
            socket.connect("8.8.8.8:80")?;
            socket.local_addr()
        })
        .ok()
        .map(|addr| addr.ip().to_string())
}

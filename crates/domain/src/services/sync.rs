use std::collections::HashMap;
use chrono::{DateTime, Utc};

use crate::command::Command;
use crate::model::sync_diff::{DiffLine, ReviewableCommand, SyncDiff};
use crate::ports::{AssetRepository, EventBus, GraphRepository, KindRepository, SyncPeerPort};
use crate::primitives::NodeId;
use super::service::{Service, ServiceError};

impl<R, K, E, A> Service<R, K, E, A>
where
    R: GraphRepository,
    K: KindRepository,
    E: EventBus,
    A: AssetRepository,
{
    pub fn load_tombstones(&self) -> Result<HashMap<NodeId, DateTime<Utc>>, ServiceError> {
        Ok(self.repo.load_tombstones()?)
    }

    pub fn push_to_remote(
        &self,
        peer: &impl SyncPeerPort,
        remote_name: Option<&str>,
    ) -> Result<(), ServiceError> {
        let meta = self.repo.load_meta()?;
        let name_obj = match remote_name {
            Some(n) => Some(crate::model::remote::RemoteName::new(n)?),
            None => None,
        };
        let target_remote = meta
            .get_remote(name_obj.as_ref())
            .ok_or_else(|| ServiceError::RemoteNotFound(remote_name.unwrap_or("default").to_string()))?;

        let graph = self.repo.load_graph()?;
        let cmds: Vec<Command> = graph
            .iter()
            .map(|node| Command::CreateNode {
                id: node.id,
                kind: node.kind.clone(),
                parent_id: graph.parent_of(node.id),
                index: 0,
                props: node.props.clone(),
            })
            .collect();

        peer.push_commands(&target_remote.url, &cmds)?;
        Ok(())
    }

    pub fn compute_sync_diff(
        &self,
        peer: &impl SyncPeerPort,
        remote_url: Option<&str>,
    ) -> Result<SyncDiff, ServiceError> {
        let meta = self.repo.load_meta()?;
        let remote_url = match remote_url {
            Some(u) => crate::model::remote::RemoteUrl::new(u)?,
            None => meta
                .get_remote(None)
                .ok_or_else(|| ServiceError::RemoteNotFound("default".to_string()))?
                .url,
        };

        let remote_graph = peer.pull_graph(&remote_url)?;
        let local_tombstones = self.repo.load_tombstones().unwrap_or_default();
        let remote_tombstones = peer.pull_tombstones(&remote_url).unwrap_or_default();
        let local_graph = self.repo.load_graph()?;

        let mut local_changes = Vec::new();
        let mut remote_changes = Vec::new();

        let title_key = crate::primitives::props::title();
        let get_node_title = |id: NodeId| -> String {
            if let Some(n) = local_graph.get(id) {
                if let Some(t) = n.props.get(&title_key).and_then(|v| v.as_text()) {
                    return t.to_string();
                }
            }
            if let Some(n) = remote_graph.get(id) {
                if let Some(t) = n.props.get(&title_key).and_then(|v| v.as_text()) {
                    return t.to_string();
                }
            }
            let id_str = id.to_string();
            format!("Nœud ({})", &id_str[..8.min(id_str.len())])
        };

        // 1. Process local nodes vs remote
        for node in local_graph.iter() {
            let id = node.id;
            let node_title = get_node_title(id);
            let remote_node = remote_graph.get(id);

            if remote_node.is_none() {
                if let Some(r_ts) = remote_tombstones.get(&id) {
                    if r_ts > &node.updated_at {
                        local_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Supprimer le nœud \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::DeleteNode {
                                id,
                                cascade: true,
                            },
                            diff_lines: vec![DiffLine::remove(format!("- Supprimer le nœud: {}", node_title))],
                        });
                    }
                } else {
                    let mut diff_lines = vec![
                        DiffLine::info(format!("Nœud: {}", node_title)),
                        DiffLine::info(format!("Type: {}", node.kind.as_str())),
                        DiffLine::add(format!("+ parent_id: {:?}", local_graph.parent_of(id))),
                    ];
                    for (k, v) in &node.props {
                        diff_lines.push(DiffLine::add(format!("+ {}: {:?}", k, v)));
                    }

                    remote_changes.push(ReviewableCommand {
                        id: uuid::Uuid::new_v4().to_string(),
                        selected: true,
                        description: format!("Créer le nœud \"{}\" ({})", node_title, node.kind.as_str()),
                        node_title: node_title.clone(),
                        cmd: Command::CreateNode {
                            id,
                            kind: node.kind.clone(),
                            parent_id: local_graph.parent_of(id),
                            index: 0,
                            props: node.props.clone(),
                        },
                        diff_lines,
                    });
                }
            } else if let Some(r_node) = remote_node {
                if node.updated_at > r_node.updated_at {
                    let mut diff_lines = vec![DiffLine::info(format!("Nœud: {}", node_title))];
                    for (k, v) in &node.props {
                        if r_node.props.get(k) != Some(v) {
                            diff_lines.push(DiffLine::add(format!("+ {}: {:?}", k, v)));
                        }
                    }

                    remote_changes.push(ReviewableCommand {
                        id: uuid::Uuid::new_v4().to_string(),
                        selected: true,
                        description: format!("Mettre à jour les propriétés de \"{}\"", node_title),
                        node_title: node_title.clone(),
                        cmd: Command::SetProps {
                            node_id: id,
                            props: node.props.clone(),
                        },
                        diff_lines,
                    });

                    if local_graph.parent_of(id) != remote_graph.parent_of(id) {
                        remote_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Déplacer le nœud \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::MoveNode {
                                node_id: id,
                                new_parent_id: local_graph.parent_of(id),
                                new_index: 0,
                            },
                            diff_lines: vec![DiffLine::info(format!("Nouveau parent: {:?}", local_graph.parent_of(id)))],
                        });
                    }

                    if node.kind != r_node.kind {
                        remote_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Changer le type de \"{}\" vers {}", node_title, node.kind.as_str()),
                            node_title: node_title.clone(),
                            cmd: Command::SetKind {
                                node_id: id,
                                new_kind: node.kind.clone(),
                            },
                            diff_lines: vec![DiffLine::info(format!("Nouveau type: {}", node.kind.as_str()))],
                        });
                    }

                    if node.view_override != r_node.view_override {
                        remote_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Mettre à jour le surchage de vue pour \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::SetViewOverride {
                                node_id: id,
                                view: node.view_override.clone(),
                            },
                            diff_lines: vec![DiffLine::info(format!("Mise en page modifiée pour {}", node_title))],
                        });
                    }
                } else if r_node.updated_at > node.updated_at {
                    let mut diff_lines = vec![DiffLine::info(format!("Nœud: {}", node_title))];
                    for (k, v) in &r_node.props {
                        if node.props.get(k) != Some(v) {
                            diff_lines.push(DiffLine::add(format!("+ {}: {:?}", k, v)));
                        }
                    }

                    local_changes.push(ReviewableCommand {
                        id: uuid::Uuid::new_v4().to_string(),
                        selected: true,
                        description: format!("Mettre à jour les propriétés de \"{}\"", node_title),
                        node_title: node_title.clone(),
                        cmd: Command::SetProps {
                            node_id: id,
                            props: r_node.props.clone(),
                        },
                        diff_lines,
                    });

                    if local_graph.parent_of(id) != remote_graph.parent_of(id) {
                        local_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Déplacer le nœud \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::MoveNode {
                                node_id: id,
                                new_parent_id: remote_graph.parent_of(id),
                                new_index: 0,
                            },
                            diff_lines: vec![DiffLine::info(format!("Nouveau parent: {:?}", remote_graph.parent_of(id)))],
                        });
                    }

                    if node.kind != r_node.kind {
                        local_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Changer le type de \"{}\" vers {}", node_title, r_node.kind.as_str()),
                            node_title: node_title.clone(),
                            cmd: Command::SetKind {
                                node_id: id,
                                new_kind: r_node.kind.clone(),
                            },
                            diff_lines: vec![DiffLine::info(format!("Nouveau type: {}", r_node.kind.as_str()))],
                        });
                    }

                    if node.view_override != r_node.view_override {
                        local_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Mettre à jour la surcharge de vue pour \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::SetViewOverride {
                                node_id: id,
                                view: r_node.view_override.clone(),
                            },
                            diff_lines: vec![DiffLine::info(format!("Mise en page modifiée pour {}", node_title))],
                        });
                    }
                }
            }
        }

        // 2. Process remote nodes not in local
        for r_node in remote_graph.iter() {
            let id = r_node.id;
            let node_title = get_node_title(id);

            if local_graph.get(id).is_none() {
                if let Some(l_ts) = local_tombstones.get(&id) {
                    if l_ts > &r_node.updated_at {
                        remote_changes.push(ReviewableCommand {
                            id: uuid::Uuid::new_v4().to_string(),
                            selected: true,
                            description: format!("Supprimer le nœud distant \"{}\"", node_title),
                            node_title: node_title.clone(),
                            cmd: Command::DeleteNode {
                                id,
                                cascade: true,
                            },
                            diff_lines: vec![
                                DiffLine::remove(format!("- Nœud: {}", node_title)),
                                DiffLine::remove(format!("- Type: {}", r_node.kind.as_str())),
                            ],
                        });
                        continue;
                    }
                }

                let mut diff_lines = vec![
                    DiffLine::info(format!("Nœud: {}", node_title)),
                    DiffLine::info(format!("Type: {}", r_node.kind.as_str())),
                    DiffLine::add(format!("+ parent_id: {:?}", remote_graph.parent_of(id))),
                ];
                for (k, v) in &r_node.props {
                    diff_lines.push(DiffLine::add(format!("+ {}: {:?}", k, v)));
                }

                local_changes.push(ReviewableCommand {
                    id: uuid::Uuid::new_v4().to_string(),
                    selected: true,
                    description: format!("Créer le nœud \"{}\" ({})", node_title, r_node.kind.as_str()),
                    node_title: node_title.clone(),
                    cmd: Command::CreateNode {
                        id,
                        kind: r_node.kind.clone(),
                        parent_id: remote_graph.parent_of(id),
                        index: 0,
                        props: r_node.props.clone(),
                    },
                    diff_lines,
                });
            }
        }

        Ok(SyncDiff {
            local_changes,
            remote_changes,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::remote::RemoteUrl;
    use crate::graph::Graph;
    use crate::model::node::NodeBuilder;
    use crate::model::primitives::kinds;
    use crate::ports::SyncError;
    use crate::services::command::Event;
    use crate::ports::RepositoryError;
    use std::sync::Mutex;

    struct DummyPeer {
        remote_graph: Graph,
        tombstones: HashMap<NodeId, chrono::DateTime<Utc>>,
    }

    impl SyncPeerPort for DummyPeer {
        fn ping(&self, _url: &RemoteUrl) -> Result<crate::ports::PeerHandshake, SyncError> {
            Ok(crate::ports::PeerHandshake {
                peer_id: "test_peer".into(),
                name: "Test".into(),
            })
        }
        fn push_commands(&self, _url: &RemoteUrl, _cmds: &[Command]) -> Result<(), SyncError> {
            Ok(())
        }
        fn pull_graph(&self, _url: &RemoteUrl) -> Result<Graph, SyncError> {
            Ok(self.remote_graph.clone())
        }
        fn pull_tombstones(&self, _url: &RemoteUrl) -> Result<HashMap<NodeId, chrono::DateTime<Utc>>, SyncError> {
            Ok(self.tombstones.clone())
        }
    }

    struct MockRepo {
        graph: Mutex<Graph>,
        tombstones: Mutex<HashMap<NodeId, chrono::DateTime<Utc>>>,
    }

    impl GraphRepository for MockRepo {
        fn load_graph(&self) -> Result<Graph, RepositoryError> {
            Ok(self.graph.lock().unwrap().clone())
        }
        fn apply_event(&self, _event: &Event) -> Result<(), RepositoryError> { Ok(()) }
        fn save_all(&self, graph: &Graph) -> Result<(), RepositoryError> {
            *self.graph.lock().unwrap() = graph.clone();
            Ok(())
        }
        fn load_tombstones(&self) -> Result<HashMap<NodeId, chrono::DateTime<Utc>>, RepositoryError> {
            Ok(self.tombstones.lock().unwrap().clone())
        }
        fn load_meta(&self) -> Result<crate::model::workspace::WorkspaceMeta, RepositoryError> {
            let mut meta = crate::model::workspace::WorkspaceMeta::new(uuid::Uuid::new_v4(), "Local");
            meta.add_remote(
                crate::model::remote::RemoteName::new("default").unwrap(),
                crate::model::remote::RemoteUrl::new("http://localhost:8080").unwrap(),
            );
            Ok(meta)
        }
        fn save_meta(&self, _meta: &crate::model::workspace::WorkspaceMeta) -> Result<(), RepositoryError> {
            Ok(())
        }
    }

    struct DummyKindRepo;
    impl crate::ports::KindRepository for DummyKindRepo {
        fn load_kinds(&self) -> Result<Vec<(crate::primitives::Kind, crate::schema::KindDef)>, RepositoryError> { Ok(vec![]) }
        fn save_kind(&self, _kind: &crate::primitives::Kind, _def: &crate::schema::KindDef) -> Result<(), RepositoryError> { Ok(()) }
        fn delete_kind(&self, _kind: &crate::primitives::Kind) -> Result<(), RepositoryError> { Ok(()) }
    }

    struct DummyAssetRepo;
    impl AssetRepository for DummyAssetRepo {
        fn import_media(&self, _source_path: &str) -> Result<String, RepositoryError> { Ok("".into()) }
        fn save_media(&self, _data: &[u8], _extension: &str) -> Result<String, RepositoryError> { Ok("".into()) }
        fn import_asset(&self, _source_path: &str) -> Result<crate::model::asset::AssetInfo, RepositoryError> {
            Err(RepositoryError::NotFound("none".into()))
        }
        fn open_external(&self, _target_path: &str) -> Result<(), RepositoryError> { Ok(()) }
        fn reveal_in_explorer(&self, _target_path: &str) -> Result<(), RepositoryError> { Ok(()) }
    }

    struct DummyBus;
    impl EventBus for DummyBus {
        fn publish(&self, _event: &Event) {}
    }

    #[test]
    fn test_compute_sync_diff_remote_node_added() {
        let local_graph = Graph::new();
        let mut remote_graph = Graph::new();

        let remote_node = NodeBuilder::new(kinds::page(), Utc::now()).build();
        let r_id = remote_node.id;
        remote_graph.insert_root(remote_node).unwrap();

        let repo = MockRepo {
            graph: Mutex::new(local_graph),
            tombstones: Mutex::new(HashMap::new()),
        };
        let service = Service::new(repo, DummyKindRepo, DummyBus, DummyAssetRepo);

        let peer = DummyPeer {
            remote_graph,
            tombstones: HashMap::new(),
        };

        let diff = service.compute_sync_diff(&peer, None).unwrap();
        assert_eq!(diff.local_changes.len(), 1);
        assert_eq!(diff.remote_changes.len(), 0);
        assert!(matches!(diff.local_changes[0].cmd, Command::CreateNode { id, .. } if id == r_id));
    }
}

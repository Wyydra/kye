import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Command, Event, Graph, KindDef, SyncDiff, WorkspaceMeta } from "../types/domain";

export interface AssetInfo {
  target_path: string;
  sidecar_path: string;
  mime_type: string;
  size_bytes: number;
}

export const kyeService = {


  async selectWorkspaceFolder(path?: string): Promise<string | null> {
    return invoke("select_workspace_folder", { path });
  },

  async getWorkspacePath(): Promise<string | null> {
    return invoke("get_workspace_path");
  },

  async listWorkspaces(): Promise<string[]> {
    return invoke("list_workspaces");
  },

  async createWorkspace(name: string): Promise<string> {
    return invoke("create_workspace", { name });
  },

  async getMeta(): Promise<WorkspaceMeta> {
    return invoke("get_meta");
  },

  async getGraph(): Promise<Graph> {
    return invoke("get_graph");
  },

  async executeCommand(command: Command): Promise<Event> {
    return invoke("execute_command", { command });
  },

  async executeBatch(commands: Command[]): Promise<Event> {
    return invoke("execute_batch", { commands });
  },

  async importMedia(sourcePath: string): Promise<string> {
    return invoke("import_media", { sourcePath });
  },

  async importAsset(sourcePath: string): Promise<AssetInfo> {
    return invoke("import_asset", { sourcePath });
  },

  async openAsset(targetPath: string): Promise<void> {
    return invoke("open_asset", { targetPath });
  },

  async revealAsset(targetPath: string): Promise<void> {
    return invoke("reveal_asset", { targetPath });
  },


  async getKinds(): Promise<[string, KindDef][]> {
    return invoke("get_kinds");
  },

  async registerKind(kind: string, def: KindDef): Promise<void> {
    return invoke("register_kind", { kind, def });
  },

  async deleteKind(kind: string): Promise<void> {
    return invoke("delete_kind", { kind });
  },

  async listenToEvents(callback: (event: Event) => void): Promise<UnlistenFn> {
    return listen<Event>("kye_event", (e) => {
      callback(e.payload);
    });
  },

  async getLocalPeerInfo(): Promise<string | null> {
    return invoke("get_local_peer_info");
  },

  async generatePairingQr(port: number, name: string, pin: string): Promise<string> {
    return invoke("generate_pairing_qr", { port, name, pin });
  },

  async startP2pServer(port: number, peerId: string, deviceName: string): Promise<void> {
    return invoke("start_p2p_server", { port, peerId, deviceName });
  },

  async stopP2pServer(): Promise<void> {
    return invoke("stop_p2p_server");
  },

  async isP2pServerRunning(): Promise<boolean> {
    return invoke("is_p2p_server_running");
  },

  async pingRemotePeer(remoteUrl: string): Promise<{ peer_id: string; name: string }> {
    return invoke("ping_remote_peer", { remoteUrl });
  },

  async pushToRemotePeer(remoteUrl: string, cmds: Command[]): Promise<void> {
    return invoke("push_to_remote_peer", { remoteUrl, cmds });
  },

  async pullRemotePeerGraph(remoteUrl: string): Promise<Graph> {
    return invoke("pull_remote_peer_graph", { remoteUrl });
  },

  async getLocalTombstones(): Promise<Record<string, string>> {
    return invoke("get_local_tombstones");
  },

  async pullRemotePeerTombstones(remoteUrl: string): Promise<Record<string, string>> {
    return invoke("pull_remote_peer_tombstones", { remoteUrl });
  },

  async addRemote(name: string, url: string): Promise<void> {
    return invoke("add_remote", { name, url });
  },

  async removeRemote(name: string): Promise<boolean> {
    return invoke("remove_remote", { name });
  },

  async listRemotes(): Promise<{ name: string; url: string }[]> {
    return invoke("list_remotes");
  },

  async computeSyncDiff(remoteUrl: string): Promise<SyncDiff> {
    return invoke("compute_sync_diff", { remoteUrl });
  },
};

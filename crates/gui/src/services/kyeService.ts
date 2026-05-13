import { invoke } from "@tauri-apps/api/core";
import { listen, UnlistenFn } from "@tauri-apps/api/event";
import { Command, Event, Graph, KindDef, WorkspaceMeta } from "../types/domain";

export const kyeService = {
  // ── Workspace ───────────────────────────────────────────────────────────

  async selectWorkspaceFolder(): Promise<string | null> {
    return invoke("select_workspace_folder");
  },

  async getWorkspacePath(): Promise<string | null> {
    return invoke("get_workspace_path");
  },

  async getMeta(): Promise<WorkspaceMeta> {
    return invoke("get_meta");
  },

  async getGraph(): Promise<Graph> {
    return invoke("get_graph");
  },

  // ── Mutations ───────────────────────────────────────────────────────────

  async executeCommand(command: Command): Promise<Event> {
    return invoke("execute_command", { command });
  },

  async executeBatch(commands: Command[]): Promise<Event> {
    return invoke("execute_batch", { commands });
  },

  // ── Kinds ───────────────────────────────────────────────────────────────

  async getKinds(): Promise<[string, KindDef][]> {
    return invoke("get_kinds");
  },

  async registerKind(kind: string, def: KindDef): Promise<void> {
    return invoke("register_kind", { kind, def });
  },

  async deleteKind(kind: string): Promise<void> {
    return invoke("delete_kind", { kind });
  },

  // ── Events ──────────────────────────────────────────────────────────────

  async listenToEvents(callback: (event: Event) => void): Promise<UnlistenFn> {
    return listen<Event>("kye_event", (e) => {
      callback(e.payload);
    });
  },
};

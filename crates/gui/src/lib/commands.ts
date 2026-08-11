import { Command, Event } from "../types/domain";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";

function commandToOptimisticEvent(cmd: Command): Event | null {
  const state = useGraphStore.getState();

  switch (cmd.type) {
    case "set_prop":
      return {
        type: "prop_set",
        node_id: cmd.node_id,
        key: cmd.key,
        new_value: cmd.value,
        old_value: state.nodes[cmd.node_id]?.props[cmd.key] || null,
      };
    case "set_props":
      return {
        type: "props_set",
        node_id: cmd.node_id,
        changes: Object.entries(cmd.props).map(([k, v]) => [
          k,
          v,
          state.nodes[cmd.node_id]?.props[k] || null,
        ]),
      };
    case "delete_prop":
      const old_val = state.nodes[cmd.node_id]?.props[cmd.key];
      if (!old_val) return null;
      return {
        type: "prop_deleted",
        node_id: cmd.node_id,
        key: cmd.key,
        old_value: old_val,
      };
    case "set_kind":
      return {
        type: "kind_set",
        node_id: cmd.node_id,
        new_kind: cmd.new_kind,
        old_kind: state.nodes[cmd.node_id]?.kind || "",
      };
    case "set_view_override":
      return {
        type: "view_override_set",
        node_id: cmd.node_id,
        new_view: cmd.view,
        old_view: state.nodes[cmd.node_id]?.view_override || null,
      };
    case "create_node":
      // No optimistic update: the backend resolves authoritative props (e.g.
      // unique title) and pushes the event via the Tauri event system.
      // Applying a speculative node here would diverge from the real state.
      return null;
    case "delete_node": {

      const node = state.nodes[cmd.id];
      if (!node) return null;

      let old_index = 0;
      if (node.parent) {
        const parent = state.nodes[node.parent];
        if (parent) {
          old_index = parent.children.indexOf(cmd.id);
        }
      } else {
        old_index = state.roots.indexOf(cmd.id);
      }

      return {
        type: "node_deleted",
        nodes: [node],
        old_parent: node.parent,
        old_index,
      };
    }
    case "move_node": {
      const node = state.nodes[cmd.node_id];
      if (!node) return null;

      let old_index = 0;
      if (node.parent) {
        const parent = state.nodes[node.parent];
        if (parent) {
          old_index = parent.children.indexOf(cmd.node_id);
        }
      } else {
        old_index = state.roots.indexOf(cmd.node_id);
      }

      return {
        type: "node_moved",
        node_id: cmd.node_id,
        old_parent: node.parent,
        old_index,
        new_parent: cmd.new_parent_id,
        new_index: cmd.new_index,
      };
    }
    default:
      return null;
  }
}

export const execute = async (cmd: Command): Promise<void> => {
  try {
    // Apply optimistic event for commands where the backend outcome is
    // fully predictable from the frontend (prop mutations, deletes, etc.).
    const optEvent = commandToOptimisticEvent(cmd);
    if (optEvent) {
      useGraphStore.getState().applyEvent(optEvent);
    }

    // Always apply the backend's authoritative response. For commands like
    // create_node where the domain mutates props (e.g. unique title), this
    // is the only way to get the correct final state into the store.
    const backendEvent = await kyeService.executeCommand(cmd);
    if (!optEvent) {
      // No optimistic event was applied, so apply the backend event directly.
      useGraphStore.getState().applyEvent(backendEvent);
    }
  } catch (e: any) {
    console.error("Command failed:", e);
    useGraphStore.getState().loadGraph(true);
  }
};

export const executeBatch = async (cmds: Command[]): Promise<void> => {
  try {
    const events = cmds
      .map(commandToOptimisticEvent)
      .filter(Boolean) as Event[];
    if (events.length > 0) {
      useGraphStore.getState().applyEvent({ type: "batch", events });
    }
    await kyeService.executeBatch(cmds);
  } catch (e: any) {
    console.error("Batch commands failed:", e);
    useGraphStore.getState().loadGraph(true);
  }
};


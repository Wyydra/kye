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
      return {
        type: "node_created",
        node: {
          id: cmd.id,
          kind: cmd.kind,
          parent: cmd.parent_id,
          children: [],
          props: cmd.props,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        index: cmd.index,
      };
    case "delete_node": {
      // Simplified: we only optimistically delete the specific node
      // The backend will cascade, and the real event will fix it up
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
    const optEvent = commandToOptimisticEvent(cmd);
    if (optEvent) {
      useGraphStore.getState().applyEvent(optEvent);
    }
    await kyeService.executeCommand(cmd);
  } catch (e: any) {
    console.error("Command failed:", e);
    // Reload graph to fix state mismatch
    useGraphStore.getState().loadGraph();
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
    useGraphStore.getState().loadGraph();
  }
};

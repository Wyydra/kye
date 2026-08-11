import { create } from "zustand";
import { Node, Event, KindDef, val } from "../types/domain";
import { kyeService } from "../services/kyeService";
import { UnlistenFn } from "@tauri-apps/api/event";
import { AppLifecycleState } from "../types/appLifecycle";
import { useUIStore } from "./uiStore";

interface GraphState {
  nodes: Record<string, Node>;
  kinds: Record<string, KindDef>;
  roots: string[];
  isLoaded: boolean;
  error: string | null;
  appLifecycle: AppLifecycleState;

  loadGraph: (forceReload?: boolean) => Promise<void>;
  applyEvent: (event: Event) => void;
}

const applyEventToState = (
  state: GraphState,
  event: Event,
): Partial<GraphState> => {
  const newNodes = { ...state.nodes };
  let newRoots = [...state.roots];

  switch (event.type) {
    case "node_created": {
      if (newNodes[event.node.id]) return state;
      const parentId = event.parent_id ?? event.node.parent ?? null;
      const createdNode: Node = {
        ...event.node,
        parent: parentId,
        children: event.node.children || [],
      };
      newNodes[createdNode.id] = createdNode;

      if (!parentId) {
        if (!newRoots.includes(createdNode.id)) {
          newRoots.push(createdNode.id);
          newRoots.sort((a, b) => {
            const nodeA = newNodes[a];
            const nodeB = newNodes[b];
            const titleA = val<string>(nodeA?.props["title"]) || "";
            const titleB = val<string>(nodeB?.props["title"]) || "";
            return titleA.toLowerCase().localeCompare(titleB.toLowerCase());
          });
        }
      } else {
        const parent = newNodes[parentId];
        if (parent && !parent.children.includes(createdNode.id)) {
          const newChildren = [...parent.children];
          const idx = Math.min(event.index, newChildren.length);
          newChildren.splice(idx, 0, createdNode.id);
          newNodes[parent.id] = { ...parent, children: newChildren };
        }
      }
      break;
    }
    case "prop_set": {
      const node = newNodes[event.node_id];
      if (node) {
        newNodes[event.node_id] = {
          ...node,
          props: { ...node.props, [event.key]: event.new_value },
        };
      }
      break;
    }
    case "props_set": {
      const node = newNodes[event.node_id];
      if (node) {
        const updatedProps = { ...node.props };
        for (const [key, value] of event.changes) {
          updatedProps[key] = value;
        }
        newNodes[event.node_id] = { ...node, props: updatedProps };
      }
      break;
    }
    case "prop_deleted": {
      const node = newNodes[event.node_id];
      if (node) {
        const updatedProps = { ...node.props };
        delete updatedProps[event.key];
        newNodes[event.node_id] = { ...node, props: updatedProps };
      }
      break;
    }
    case "kind_set": {
      const node = newNodes[event.node_id];
      if (node) {
        newNodes[event.node_id] = { ...node, kind: event.new_kind };
      }
      break;
    }
    case "view_override_set": {
      const node = newNodes[event.node_id];
      if (node) {
        newNodes[event.node_id] = {
          ...node,
          view_override: event.new_view ?? undefined,
        };
      }
      break;
    }
    case "node_moved": {
      const node = newNodes[event.node_id];
      if (!node) return state;

      const oldParentId = event.old_parent ?? node.parent;
      const newParentId = event.new_parent;
      const newIndex = event.new_index;

      if (oldParentId === newParentId) {
        let siblingList = oldParentId
          ? [...(newNodes[oldParentId]?.children || [])]
          : [...newRoots];

        siblingList = siblingList.filter((id) => id !== event.node_id);
        const targetIdx = Math.min(newIndex, siblingList.length);
        siblingList.splice(targetIdx, 0, event.node_id);

        if (oldParentId) {
          const oldParent = newNodes[oldParentId];
          if (oldParent) {
            newNodes[oldParentId] = { ...oldParent, children: siblingList };
          }
        } else {
          newRoots = siblingList;
        }
      } else {
        if (oldParentId) {
          const oldParent = newNodes[oldParentId];
          if (oldParent) {
            newNodes[oldParentId] = {
              ...oldParent,
              children: oldParent.children.filter((id) => id !== event.node_id),
            };
          }
        } else {
          newRoots = newRoots.filter((id) => id !== event.node_id);
        }

        if (newParentId) {
          const newParent = newNodes[newParentId];
          if (newParent) {
            const newChildren = newParent.children.filter((id) => id !== event.node_id);
            const targetIdx = Math.min(newIndex, newChildren.length);
            newChildren.splice(targetIdx, 0, event.node_id);
            newNodes[newParentId] = { ...newParent, children: newChildren };
          }
        } else {
          newRoots = newRoots.filter((id) => id !== event.node_id);
          const targetIdx = Math.min(newIndex, newRoots.length);
          newRoots.splice(targetIdx, 0, event.node_id);
        }

        newNodes[event.node_id] = { ...node, parent: newParentId };
      }
      break;
    }
    case "node_deleted": {
      const deletedNodes = event.nodes;
      const deletedIds = new Set<string>(deletedNodes.map((n) => n.id));

      if (deletedIds.size === 0) return state;

      newRoots = newRoots.filter((id) => !deletedIds.has(id));

      if (event.old_parent && newNodes[event.old_parent]) {
        const oldParentNode = newNodes[event.old_parent];
        newNodes[event.old_parent] = {
          ...oldParentNode,
          children: oldParentNode.children.filter((id) => !deletedIds.has(id)),
        };
      }

      for (const nodeId of Object.keys(newNodes)) {
        if (deletedIds.has(nodeId)) continue;
        const n = newNodes[nodeId];
        if (n.children && n.children.some((id) => deletedIds.has(id))) {
          newNodes[nodeId] = {
            ...n,
            children: n.children.filter((id) => !deletedIds.has(id)),
          };
        }
      }

      for (const id of deletedIds) {
        delete newNodes[id];
      }

      // Cleanup UI store
      const uiState = useUIStore.getState();
      if (uiState.focusedNodeId && deletedIds.has(uiState.focusedNodeId)) {
        uiState.setFocusedNode(null);
      }
      if (uiState.modalNodeId && deletedIds.has(uiState.modalNodeId)) {
        uiState.setModalNodeId(null);
      }
      for (const id of deletedIds) {
        if (uiState.openBufferIds.includes(id)) {
          uiState.closeBuffer(id);
        }
      }
      break;
    }
    case "batch": {
      for (const subEvent of event.events) {
        const subState = applyEventToState(
          { ...state, nodes: newNodes, roots: newRoots },
          subEvent,
        );
        if (subState.nodes) Object.assign(newNodes, subState.nodes);
        if (subState.roots) newRoots = subState.roots;
      }
      break;
    }
  }

  return { nodes: newNodes, roots: newRoots };
};

let unlisten: UnlistenFn | null = null;

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: {},
  kinds: {},
  roots: [],
  isLoaded: false,
  error: null,
  appLifecycle: { status: "UNINITIALIZED" },

  loadGraph: async (forceReload = false) => {
    if (!forceReload && get().isLoaded && unlisten) return;

    try {
      // Hexagonal State Machine: Check workspace status via domain port
      const status = await kyeService.getWorkspaceStatus();

      if (!status.isSelected) {
        set({
          appLifecycle: { status: "NO_WORKSPACE" },
          isLoaded: false,
          error: null,
        });
        return;
      }

      set({
        appLifecycle: { status: "LOADING_WORKSPACE", path: status.path || undefined },
      });

      const [graph, kindsArray] = await Promise.all([
        kyeService.getGraph(),
        kyeService.getKinds(),
      ]);

      const kinds: Record<string, KindDef> = {};
      for (const [id, def] of kindsArray) {
        kinds[id] = def;
      }

      set({
        nodes: graph.nodes,
        kinds,
        roots: graph.roots,
        isLoaded: true,
        error: null,
        appLifecycle: { status: "READY", path: status.path || "" },
      });

      if (!unlisten) {
        const promise = kyeService.listenToEvents((event) => {
          get().applyEvent(event);
        });
        unlisten = await promise;
      }
    } catch (e: any) {
      set({
        error: e.toString(),
        isLoaded: false,
        appLifecycle: { status: "FATAL_ERROR", message: e.toString() },
      });
    }
  },

  applyEvent: (event: Event) => {
    set((state) => applyEventToState(state, event));
  },
}));


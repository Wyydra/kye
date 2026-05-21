import { create } from "zustand";
import { Node, Event, KindDef, val } from "../types/domain";
import { kyeService } from "../services/kyeService";
import { UnlistenFn } from "@tauri-apps/api/event";

interface GraphState {
  nodes: Record<string, Node>;
  kinds: Record<string, KindDef>;
  roots: string[];
  isLoaded: boolean;
  error: string | null;

  loadGraph: () => Promise<void>;
  applyEvent: (event: Event) => void;
}

const applyEventToState = (
  state: GraphState,
  event: Event,
): Partial<GraphState> => {
  const newNodes = { ...state.nodes };
  let newRoots = [...state.roots];

  switch (event.type) {
    case "node_created":
      // Dedup: the backend pushes the authoritative event via Tauri.
      // If the node already exists (shouldn't happen without optimistic updates),
      // skip to avoid double-inserting.
      if (newNodes[event.node.id]) return state;
      newNodes[event.node.id] = event.node;
      if (!event.node.parent) {
        if (!newRoots.includes(event.node.id)) {
          newRoots.push(event.node.id);
          newRoots.sort((a, b) => {
            const nodeA = newNodes[a];
            const nodeB = newNodes[b];
            const titleA = val<string>(nodeA?.props["title"]) || "";
            const titleB = val<string>(nodeB?.props["title"]) || "";
            return titleA.toLowerCase().localeCompare(titleB.toLowerCase());
          });
        }
      } else {
        const parent = newNodes[event.node.parent];
        if (parent && !parent.children.includes(event.node.id)) {
          const newChildren = [...parent.children];
          const idx = Math.min(event.index, newChildren.length);
          newChildren.splice(idx, 0, event.node.id);
          newNodes[parent.id] = { ...parent, children: newChildren };
        }
      }
      break;

    case "node_deleted":
      for (const node of event.nodes) {
        delete newNodes[node.id];
      }
      if (event.old_parent === null) {
        newRoots = newRoots.filter((id) => id !== event.nodes[0].id);
      } else {
        const parent = newNodes[event.old_parent];
        if (parent) {
          newNodes[parent.id] = {
            ...parent,
            children: parent.children.filter((id) => id !== event.nodes[0].id),
          };
        }
      }
      break;

    case "node_moved": {

      if (event.old_parent === null) {
        newRoots = newRoots.filter((id) => id !== event.node_id);
      } else {
        const parent = newNodes[event.old_parent];
        if (parent) {
          newNodes[parent.id] = {
            ...parent,
            children: parent.children.filter((id) => id !== event.node_id),
          };
        }
      }
      if (event.new_parent !== null && event.new_parent !== event.old_parent) {
        const nParent = newNodes[event.new_parent];
        if (nParent) {
          newNodes[nParent.id] = {
            ...nParent,
            children: nParent.children.filter((id) => id !== event.node_id),
          };
        }
      } else if (event.new_parent === null && event.old_parent !== null) {
        newRoots = newRoots.filter((id) => id !== event.node_id);
      }

      if (event.new_parent === null) {
        const idx = Math.min(event.new_index, newRoots.length);
        newRoots.splice(idx, 0, event.node_id);
      } else {
        const parent = newNodes[event.new_parent];
        if (parent) {
          const newChildren = [...parent.children];
          const idx = Math.min(event.new_index, newChildren.length);
          newChildren.splice(idx, 0, event.node_id);
          newNodes[parent.id] = { ...parent, children: newChildren };
        }
      }

      const movedNode = newNodes[event.node_id];
      if (movedNode) {
        newNodes[event.node_id] = { ...movedNode, parent: event.new_parent };
      }
      break;
    }

    case "prop_set": {
      const nodeToSet = newNodes[event.node_id];
      if (nodeToSet) {
        newNodes[event.node_id] = {
          ...nodeToSet,
          props: { ...nodeToSet.props, [event.key]: event.new_value },
        };
      }
      break;
    }

    case "prop_deleted": {
      const nodeToDel = newNodes[event.node_id];
      if (nodeToDel) {
        const newProps = { ...nodeToDel.props };
        delete newProps[event.key];
        newNodes[event.node_id] = { ...nodeToDel, props: newProps };
      }
      break;
    }

    case "props_set": {
      const nodeToSetProps = newNodes[event.node_id];
      if (nodeToSetProps) {
        const newProps = { ...nodeToSetProps.props };
        for (const [key, value] of event.changes) {
          newProps[key] = value;
        }
        newNodes[event.node_id] = { ...nodeToSetProps, props: newProps };
      }
      break;
    }

    case "kind_set": {
      const nodeToSetKind = newNodes[event.node_id];
      if (nodeToSetKind) {
        newNodes[event.node_id] = {
          ...nodeToSetKind,
          kind: event.new_kind,
        };
      }
      break;
    }

    case "view_override_set": {
      const nodeToOverride = newNodes[event.node_id];
      if (nodeToOverride) {
        newNodes[event.node_id] = {
          ...nodeToOverride,
          view_override: event.new_view ?? undefined,
        };
      }
      break;
    }

    case "batch": {
      let tempState: Partial<GraphState> = { nodes: newNodes, roots: newRoots };
      for (const e of event.events) {
        tempState = {
          ...tempState,
          ...applyEventToState(tempState as GraphState, e),
        };
      }
      return tempState;
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

  loadGraph: async () => {
    if (get().isLoaded && unlisten) return; 

    try {
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
      });

      if (!unlisten) {
        const promise = kyeService.listenToEvents((event) => {
          get().applyEvent(event);
        });
        unlisten = await promise;
      }
    } catch (e: any) {
      set({ error: e.toString(), isLoaded: false });
    }
  },

  applyEvent: (event: Event) => {
    set((state) => applyEventToState(state, event));
  },
}));

import { create } from "zustand";

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface NodeState {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ConnectionDraft {
  sourceId: string;
  targetId: string | null;
  currentX: number;
  currentY: number;
}

interface CanvasState {
  viewport: Viewport;
  setViewport: (viewport: Viewport) => void;
  
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  // Transient state for fluid movement and edge calculations
  nodeStates: Record<string, NodeState>;
  updateNodeState: (id: string, state: Partial<NodeState>) => void;
  removeNodeState: (id: string) => void;
  setAllNodeStates: (states: Record<string, NodeState>) => void;

  connectionDraft: ConnectionDraft | null;
  setConnectionDraft: (draft: ConnectionDraft | null) => void;
  updateConnectionDraft: (x: number, y: number, targetId: string | null) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  setViewport: (viewport) => set({ viewport }),
  
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),

  nodeStates: {},
  updateNodeState: (id, update) => set((state) => ({
    nodeStates: {
      ...state.nodeStates,
      [id]: { ...(state.nodeStates[id] || { x: 0, y: 0, width: 300, height: 200 }), ...update }
    }
  })),
  removeNodeState: (id) => set((state) => {
    const next = { ...state.nodeStates };
    delete next[id];
    return { nodeStates: next };
  }),
  setAllNodeStates: (nodeStates) => set({ nodeStates }),

  connectionDraft: null,
  setConnectionDraft: (connectionDraft) => set({ connectionDraft }),
  updateConnectionDraft: (x, y, targetId) => set((state) => ({
    connectionDraft: state.connectionDraft ? { ...state.connectionDraft, currentX: x, currentY: y, targetId } : null
  })),
}));

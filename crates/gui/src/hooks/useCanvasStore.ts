import { create } from 'zustand';

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
  mouseX: number;
  mouseY: number;
}

interface CanvasState {
  viewport: Viewport;
  selectedNodeId: string | null;
  editingBlockId: string | null;
  nodeStates: Record<string, NodeState>;
  connectionDraft: ConnectionDraft | null;
  
  // Actions
  setViewport: (viewport: Partial<Viewport>) => void;
  setSelectedNodeId: (id: string | null) => void;
  setEditingBlockId: (id: string | null) => void;
  updateNodeState: (id: string, state: NodeState) => void;
  removeNodeState: (id: string) => void;
  setAllNodeStates: (states: Record<string, NodeState>) => void;
  
  setConnectionDraft: (draft: ConnectionDraft | null) => void;
  updateConnectionMouse: (x: number, y: number) => void;
  
  resetViewport: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,
  editingBlockId: null,
  nodeStates: {},
  connectionDraft: null,

  setViewport: (v) => set((state) => ({ 
    viewport: { ...state.viewport, ...v } 
  })),
  
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  setEditingBlockId: (id) => set({ editingBlockId: id }),

  updateNodeState: (id, state) => set((prev) => ({
    nodeStates: { ...prev.nodeStates, [id]: state }
  })),

  removeNodeState: (id) => set((prev) => {
    const next = { ...prev.nodeStates };
    delete next[id];
    return { nodeStates: next };
  }),

  setAllNodeStates: (states) => set({ nodeStates: states }),

  setConnectionDraft: (draft) => set({ connectionDraft: draft }),
  
  updateConnectionMouse: (x, y) => set((state) => ({
    connectionDraft: state.connectionDraft ? { ...state.connectionDraft, mouseX: x, mouseY: y } : null
  })),
  
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),
}));

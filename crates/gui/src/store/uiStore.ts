import { create } from "zustand";
import { useCanvasStore } from "./canvasStore";

export type ViewMode = "editor" | "graph";

interface UIState {
  activeViewMode: ViewMode;
  setActiveViewMode: (mode: ViewMode) => void;
  focusedNodeId: string | null;
  setFocusedNode: (id: string | null) => void;
  modalNodeId: string | null;
  setModalNodeId: (id: string | null) => void;
  isWorkspaceSwitcherOpen: boolean;
  setWorkspaceSwitcherOpen: (open: boolean) => void;
  isCreateWorkspaceModalOpen: boolean;
  setCreateWorkspaceModalOpen: (open: boolean) => void;
  isSyncPanelOpen: boolean;
  setSyncPanelOpen: (open: boolean) => void;
  isTypeManagerOpen: boolean;
  setTypeManagerOpen: (open: boolean) => void;
  isInspectorOpen: boolean;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;

  // Real Multi-Buffer State
  openBufferIds: string[];
  openBuffer: (id: string) => void;
  closeBuffer: (id: string) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeViewMode: "editor",
  setActiveViewMode: (activeViewMode) => set({ activeViewMode }),
  focusedNodeId: null,
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  modalNodeId: null,
  setModalNodeId: (id) => set({ modalNodeId: id }),
  isWorkspaceSwitcherOpen: false,
  setWorkspaceSwitcherOpen: (open) => set({ isWorkspaceSwitcherOpen: open }),
  isCreateWorkspaceModalOpen: false,
  setCreateWorkspaceModalOpen: (open) => set({ isCreateWorkspaceModalOpen: open }),
  isSyncPanelOpen: false,
  setSyncPanelOpen: (open) => set({ isSyncPanelOpen: open }),
  isTypeManagerOpen: false,
  setTypeManagerOpen: (open) => set({ isTypeManagerOpen: open }),
  isInspectorOpen: false,
  setInspectorOpen: (open) => set({ isInspectorOpen: open }),
  toggleInspector: () => set((state) => ({ isInspectorOpen: !state.isInspectorOpen })),

  openBufferIds: [],
  openBuffer: (id: string) => {
    const current = get().openBufferIds;
    if (!current.includes(id)) {
      set({ openBufferIds: [...current, id] });
    }
    useCanvasStore.getState().setSelectedNodeId(id);
    set({ activeViewMode: "editor" });
  },
  closeBuffer: (id: string) => {
    const current = get().openBufferIds;
    const updated = current.filter((bId) => bId !== id);
    set({ openBufferIds: updated });

    const selectedId = useCanvasStore.getState().selectedNodeId;
    if (selectedId === id) {
      const nextId = updated.length > 0 ? updated[updated.length - 1] : null;
      useCanvasStore.getState().setSelectedNodeId(nextId);
    }
  },
  resetUI: () => {
    useCanvasStore.getState().setSelectedNodeId(null);
    set({
      openBufferIds: [],
      focusedNodeId: null,
      modalNodeId: null,
      isWorkspaceSwitcherOpen: false,
      isCreateWorkspaceModalOpen: false,
      isSyncPanelOpen: false,
      isTypeManagerOpen: false,
      isInspectorOpen: false,
      activeViewMode: "editor",
    });
  },
}));

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
  isWorkspacePickerOpen: boolean;
  setWorkspacePickerOpen: (open: boolean) => void;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  isSyncPanelOpen: boolean;
  setSyncPanelOpen: (open: boolean) => void;

  // Real Multi-Buffer State
  openBufferIds: string[];
  openBuffer: (id: string) => void;
  closeBuffer: (id: string) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeViewMode: "editor",
  setActiveViewMode: (activeViewMode) => set({ activeViewMode }),
  focusedNodeId: null,
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  modalNodeId: null,
  setModalNodeId: (id) => set({ modalNodeId: id }),
  isWorkspacePickerOpen: false,
  setWorkspacePickerOpen: (open) => set({ isWorkspacePickerOpen: open }),
  isSidebarOpen: true,
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isSyncPanelOpen: false,
  setSyncPanelOpen: (open) => set({ isSyncPanelOpen: open }),

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
}));

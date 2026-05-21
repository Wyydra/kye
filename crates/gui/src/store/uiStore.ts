import { create } from "zustand";

interface UIState {
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
}

export const useUIStore = create<UIState>((set) => ({
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
}));

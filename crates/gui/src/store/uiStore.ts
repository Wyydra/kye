import { create } from "zustand";

interface UIState {
  activePageId: string | null;
  focusedNodeId: string | null;

  setActivePage: (id: string | null) => void;
  setFocusedNode: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activePageId: null,
  focusedNodeId: null,

  setActivePage: (id) => set({ activePageId: id }),
  setFocusedNode: (id) => set({ focusedNodeId: id }),
}));

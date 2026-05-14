import { create } from "zustand";

interface UIState {
  focusedNodeId: string | null;
  setFocusedNode: (id: string | null) => void;
  modalNodeId: string | null;
  setModalNodeId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  focusedNodeId: null,
  setFocusedNode: (id) => set({ focusedNodeId: id }),
  modalNodeId: null,
  setModalNodeId: (id) => set({ modalNodeId: id }),
}));

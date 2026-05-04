import { create } from 'zustand';

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface CanvasState {
  viewport: Viewport;
  selectedNodeId: string | null;
  
  // Actions
  setViewport: (viewport: Partial<Viewport>) => void;
  setSelectedNodeId: (id: string | null) => void;
  resetViewport: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  selectedNodeId: null,

  setViewport: (v) => set((state) => ({ 
    viewport: { ...state.viewport, ...v } 
  })),
  
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  
  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),
}));

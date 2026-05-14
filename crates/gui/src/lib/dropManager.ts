import { listen } from "@tauri-apps/api/event";

export type DropHandler = (paths: string[], position: { x: number; y: number }) => void;

// Store handlers by DOM element
const dropHandlers = new Map<HTMLElement, DropHandler>();

let isListening = false;

export const DropManager = {
  /**
   * Initialize the global Tauri drag-and-drop listener.
   * Call this once at the root of the app (e.g. MainLayout).
   */
  init: () => {
    if (isListening) return;
    isListening = true;

    listen("tauri://drag-drop", (event: any) => {
      const position = event.payload?.position;
      const paths = event.payload?.paths || event.payload;

      if (!position || !Array.isArray(paths) || paths.length === 0) return;

      // Find all DOM elements at the drop position, from top-most to bottom-most
      const elements = document.elementsFromPoint(position.x, position.y);

      // Trigger the first registered handler we find (most specific child first)
      for (const el of elements) {
        const handler = dropHandlers.get(el as HTMLElement);
        if (handler) {
          handler(paths, position);
          return; // Stop propagation
        }
      }
    }).catch(console.error);
  },

  register: (el: HTMLElement, handler: DropHandler) => {
    dropHandlers.set(el, handler);
  },

  unregister: (el: HTMLElement) => {
    dropHandlers.delete(el);
  }
};

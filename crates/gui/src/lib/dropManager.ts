import { listen } from "@tauri-apps/api/event";

export type DropHandler = (paths: string[], position: { x: number; y: number }) => void;

const dropHandlers = new Map<HTMLElement, DropHandler>();

let isListening = false;

export const DropManager = {

  init: () => {
    if (isListening) return;
    isListening = true;

    listen("tauri://drag-drop", (event: any) => {
      const position = event.payload?.position;
      const paths = event.payload?.paths || event.payload;

      if (!position || !Array.isArray(paths) || paths.length === 0) return;

      const elements = document.elementsFromPoint(position.x, position.y);

      for (const el of elements) {
        const handler = dropHandlers.get(el as HTMLElement);
        if (handler) {
          handler(paths, position);
          return; 
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

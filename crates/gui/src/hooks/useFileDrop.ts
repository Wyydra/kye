import { useEffect, useRef } from "react";
import { DropManager, DropHandler } from "../lib/dropManager";

/**
 * Hook to securely intercept file drops from Tauri.
 * Returns a React ref that should be attached to the target DOM element.
 */
export function useFileDrop<T extends HTMLElement = HTMLDivElement>(handler: DropHandler) {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);

  // Keep the latest handler without causing re-registrations
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // We pass a stable wrapper to the manager
    const stableHandler: DropHandler = (paths, position) => {
      handlerRef.current(paths, position);
    };

    DropManager.register(el, stableHandler);

    return () => {
      DropManager.unregister(el);
    };
  }, []);

  return ref;
}

import { useEffect, useRef } from "react";
import { DropManager, DropHandler } from "../lib/dropManager";

export function useFileDrop<T extends HTMLElement = HTMLDivElement>(handler: DropHandler) {
  const ref = useRef<T>(null);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

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

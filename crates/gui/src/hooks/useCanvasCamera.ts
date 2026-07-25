import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "../store/canvasStore";

export function useCanvasCamera(
  containerRef: React.RefObject<HTMLDivElement | null>,
  layerRef: React.RefObject<HTMLDivElement | null>,
) {
  const { viewport, setViewport } = useCanvasStore();

  const cameraRef = useRef(viewport);

  useEffect(() => {
    cameraRef.current = viewport;
    updateTransform();
  }, [viewport]);

  const updateTransform = useCallback(() => {
    if (layerRef.current) {
      const { x, y, zoom } = cameraRef.current;
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      layerRef.current.style.transform = `translate3d(${rx}px, ${ry}px, 0px) scale(${zoom})`;
    }
  }, [layerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activePointers = new Map<number, { x: number; y: number }>();
    let lastDistance = 0;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const { x, y, zoom } = cameraRef.current;

      if (e.ctrlKey || e.metaKey) {

        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const newZoom = Math.min(Math.max(zoom * Math.pow(2, delta * zoomSpeed), 0.1), 5);

        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;

        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;

        cameraRef.current = { x: newX, y: newY, zoom: newZoom };
      } else {

        cameraRef.current = { 
          x: x - e.deltaX, 
          y: y - e.deltaY, 
          zoom 
        };
      }

      updateTransform();
      setViewport(cameraRef.current);
    };

    const handlePointerDown = (e: PointerEvent) => {

      if (e.target !== container && !(e.target as HTMLElement).classList.contains('canvas-background')) {
        return;
      }

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {

      } else if (activePointers.size === 2) {

        const pts = Array.from(activePointers.values());
        lastDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!activePointers.has(e.pointerId)) return;

      const prevPos = activePointers.get(e.pointerId)!;
      const dx = e.clientX - prevPos.x;
      const dy = e.clientY - prevPos.y;

      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size === 1) {

        const { x, y, zoom } = cameraRef.current;
        cameraRef.current = { x: x + dx, y: y + dy, zoom };
        updateTransform();
        setViewport(cameraRef.current);
      } else if (activePointers.size === 2) {

        const pts = Array.from(activePointers.values());
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);

        if (lastDistance > 0) {
          const zoomFactor = distance / lastDistance;
          const { x, y, zoom } = cameraRef.current;
          const newZoom = Math.min(Math.max(zoom * zoomFactor, 0.1), 5);

          const rect = container.getBoundingClientRect();
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;

          const worldX = (midX - x) / zoom;
          const worldY = (midY - y) / zoom;

          const newX = midX - worldX * newZoom;
          const newY = midY - worldY * newZoom;

          cameraRef.current = { x: newX, y: newY, zoom: newZoom };
          updateTransform();
          setViewport(cameraRef.current);
        }
        lastDistance = distance;
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      activePointers.delete(e.pointerId);
      if (activePointers.size < 2) {
        lastDistance = 0;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [containerRef, updateTransform, setViewport]);

  useEffect(() => {
    updateTransform();
  }, [updateTransform]);

  return { viewport: cameraRef.current };
}

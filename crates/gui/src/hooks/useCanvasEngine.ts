import { useCallback, useRef, useState, useLayoutEffect } from 'react';

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export function useCanvasEngine() {
  const viewportRef = useRef<ViewportState>({ x: 0, y: 0, zoom: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const updateTransform = useCallback(() => {
    if (layerRef.current) {
      const { x, y, zoom } = viewportRef.current;
      layerRef.current.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${zoom})`;
    }
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = viewportRef.current;
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const factor = Math.pow(1.1, delta / 100);
        const newZoom = Math.min(Math.max(zoom * factor, 0.1), 5);
        
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom centered on mouse
        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        
        viewportRef.current = {
          x: mouseX - worldX * newZoom,
          y: mouseY - worldY * newZoom,
          zoom: newZoom,
        };
      } else {
        // Pan
        viewportRef.current = {
          x: x - e.deltaX,
          y: y - e.deltaY,
          zoom,
        };
      }
      updateTransform();
    };

    let isPanning = false;
    let lastPos = { x: 0, y: 0 };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) { // Middle click or Alt+Left
        isPanning = true;
        lastPos = { x: e.clientX, y: e.clientY };
        container.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      viewportRef.current.x += dx;
      viewportRef.current.y += dy;
      updateTransform();
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isPanning) {
        isPanning = false;
        container.releasePointerCapture(e.pointerId);
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('pointerup', handlePointerUp);

    updateTransform();

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
    };
  }, [updateTransform]);

  return { containerRef, layerRef, viewportRef };
}

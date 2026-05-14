import { useRef, useEffect, useCallback } from "react";
import { useCanvasStore } from "../store/canvasStore";

export function useCanvasCamera(
  containerRef: React.RefObject<HTMLDivElement>,
  layerRef: React.RefObject<HTMLDivElement>,
) {
  const { viewport, setViewport } = useCanvasStore();
  
  // Use a ref for high-frequency updates to avoid React render cycle bottlenecks
  const cameraRef = useRef(viewport);
  
  // Update ref when store changes (e.g. from external reset)
  useEffect(() => {
    cameraRef.current = viewport;
    updateTransform();
  }, [viewport]);

  const updateTransform = useCallback(() => {
    if (layerRef.current) {
      const { x, y, zoom } = cameraRef.current;
      layerRef.current.style.transform = `translate(${x}px, ${y}px) scale(${zoom})`;
    }
  }, [layerRef]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const { x, y, zoom } = cameraRef.current;
      
      if (e.ctrlKey || e.metaKey) {
        // Zoom
        const zoomSpeed = 0.001;
        const delta = -e.deltaY;
        const newZoom = Math.min(Math.max(zoom * Math.pow(2, delta * zoomSpeed), 0.1), 5);
        
        // Zoom towards mouse
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX - x) / zoom;
        const worldY = (mouseY - y) / zoom;
        
        const newX = mouseX - worldX * newZoom;
        const newY = mouseY - worldY * newZoom;
        
        cameraRef.current = { x: newX, y: newY, zoom: newZoom };
      } else {
        // Pan with wheel
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
      // Only pan if clicking the container itself (the background)
      if (e.target !== container) return;
      if (e.button !== 0 && e.button !== 1) return; // Left or Middle click
      
      const startX = e.clientX;
      const startY = e.clientY;
      const { x: camX, y: camY } = cameraRef.current;

      const onPointerMove = (moveEvent: PointerEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        cameraRef.current = { 
          ...cameraRef.current, 
          x: camX + dx, 
          y: camY + dy 
        };
        
        updateTransform();
        setViewport(cameraRef.current);
      };

      const onPointerUp = () => {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('pointerdown', handlePointerDown);
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [containerRef, updateTransform, setViewport]);

  // Initial transform
  useEffect(() => {
    updateTransform();
  }, [updateTransform]);

  return { viewport: cameraRef.current };
}

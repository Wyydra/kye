import React, { useCallback } from 'react';

interface Position {
  x: number;
  y: number;
}

export function useDraggable(
  zoom: number,
  pos: Position,
  setPos: (pos: Position) => void,
  onSelect: () => void,
  onDragEnd: (finalPos: Position) => void
) {
  const startDragging = useCallback((e: React.PointerEvent) => {
    onSelect();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startNodeX = pos.x;
    const startNodeY = pos.y;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      setPos({ x: startNodeX + dx, y: startNodeY + dy });
    };

    const onUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      const dx = (upEvent.clientX - startX) / zoom;
      const dy = (upEvent.clientY - startY) / zoom;
      const finalPos = {
        x: Math.round(startNodeX + dx),
        y: Math.round(startNodeY + dy)
      };
      onDragEnd(finalPos);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [pos, zoom, onSelect, setPos, onDragEnd]);

  return { startDragging };
}

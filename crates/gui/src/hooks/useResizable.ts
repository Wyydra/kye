import { useCallback } from 'react';

export type HandleType = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

interface Size {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

export function useResizable(
  zoom: number,
  size: Size,
  setSize: (size: Size) => void,
  pos: Position,
  setPos: (pos: Position) => void,
  onResizeEnd: (finalPos: Position, finalSize: Size) => void
) {
  const startResizing = useCallback((e: React.PointerEvent, type: HandleType) => {
    e.stopPropagation();
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const startXpos = pos.x;
    const startYpos = pos.y;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      
      let newW = startW;
      let newH = startH;
      let newX = startXpos;
      let newY = startYpos;

      if (type.includes('e')) newW = Math.max(200, startW + dx);
      if (type.includes('s')) newH = Math.max(150, startH + dy);
      if (type.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= 200) {
          newW = potentialW;
          newX = startXpos + dx;
        }
      }
      if (type.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= 150) {
          newH = potentialH;
          newY = startYpos + dy;
        }
      }
      
      setPos({ x: newX, y: newY });
      setSize({ width: newW, height: newH });
    };

    const onUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      const dx = (upEvent.clientX - startX) / zoom;
      const dy = (upEvent.clientY - startY) / zoom;
      
      let finalW = startW;
      let finalH = startH;
      let finalX = startXpos;
      let finalY = startYpos;

      if (type.includes('e')) finalW = Math.max(200, startW + dx);
      if (type.includes('s')) finalH = Math.max(150, startH + dy);
      if (type.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= 200) {
          finalW = potentialW;
          finalX = startXpos + dx;
        }
      }
      if (type.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= 150) {
          finalH = potentialH;
          finalY = startYpos + dy;
        }
      }

      onResizeEnd(
        { x: Math.round(finalX), y: Math.round(finalY) },
        { width: Math.round(finalW), height: Math.round(finalH) }
      );
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [size, pos, zoom, setSize, setPos, onResizeEnd]);

  return { startResizing };
}

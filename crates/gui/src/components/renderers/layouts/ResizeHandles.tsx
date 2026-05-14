import React from 'react';
import { HandleType } from '../../../hooks/useResizable';

interface ResizeHandlesProps {
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
}

const HANDLE_CONFIGS: { id: HandleType, pos: string, cursor: string }[] = [
  { id: 'nw', pos: '-top-1.5 -left-1.5', cursor: 'cursor-nwse-resize' },
  { id: 'ne', pos: '-top-1.5 -right-1.5', cursor: 'cursor-nesw-resize' },
  { id: 'sw', pos: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
  { id: 'se', pos: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
  { id: 'n', pos: '-top-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { id: 's', pos: '-bottom-1.5 left-1/2 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { id: 'w', pos: '-left-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { id: 'e', pos: '-right-1.5 top-1/2 -translate-y-1/2', cursor: 'cursor-ew-resize' },
];

export const ResizeHandles: React.FC<ResizeHandlesProps> = ({ onResizeStart }) => {
  return (
    <>
      {HANDLE_CONFIGS.map(handle => (
        <div 
          key={handle.id}
          className={`absolute w-3 h-3 bg-background border-2 border-primary rounded-sm pointer-events-auto transition-transform hover:scale-125 z-50 interactive-handle ${handle.pos} ${handle.cursor}`}
          onPointerDown={(e) => { 
            e.stopPropagation(); 
            onResizeStart(e, handle.id); 
          }}
        />
      ))}
    </>
  );
};

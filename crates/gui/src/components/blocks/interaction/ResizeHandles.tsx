import React from 'react';
import { cn } from '../../../lib/utils';
import { HandleType } from '../../../hooks/useResizable';

interface ResizeHandlesProps {
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
}

const HANDLE_CONFIGS = [
  { id: 'nw' as HandleType, pos: '-top-1.5 -left-1.5', cursor: 'cursor-nwse-resize' },
  { id: 'ne' as HandleType, pos: '-top-1.5 -right-1.5', cursor: 'cursor-nesw-resize' },
  { id: 'sw' as HandleType, pos: '-bottom-1.5 -left-1.5', cursor: 'cursor-nesw-resize' },
  { id: 'se' as HandleType, pos: '-bottom-1.5 -right-1.5', cursor: 'cursor-nwse-resize' },
];

export const ResizeHandles = ({ onResizeStart }: ResizeHandlesProps) => {
  return (
    <>
      {HANDLE_CONFIGS.map(handle => (
        <div 
          key={handle.id}
          className={cn(
            "absolute w-3 h-3 bg-background border-2 border-primary rounded-sm pointer-events-auto transition-transform hover:scale-125 z-10 interactive-handle",
            handle.pos,
            handle.cursor
          )}
          onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, handle.id); }}
        />
      ))}
    </>
  );
};

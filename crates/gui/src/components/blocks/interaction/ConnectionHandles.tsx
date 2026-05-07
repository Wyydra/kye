import React from 'react';
import { cn } from '../../../lib/utils';

interface ConnectionHandlesProps {
  onConnectStart: (e: React.PointerEvent) => void;
}

const CONN_CONFIGS = [
  { id: 'top', pos: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2' },
  { id: 'bottom', pos: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2' },
  { id: 'left', pos: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2' },
  { id: 'right', pos: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2' },
];

export const ConnectionHandles = ({ onConnectStart }: ConnectionHandlesProps) => {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {CONN_CONFIGS.map(conn => (
        <div 
          key={conn.id}
          className={cn(
            "absolute w-2.5 h-2.5 bg-primary rounded-full pointer-events-auto cursor-crosshair transition-all duration-300 ring-4 ring-primary/10 hover:scale-125 hover:ring-primary/30 interactive-handle",
            conn.pos
          )}
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
        />
      ))}
    </div>
  );
};

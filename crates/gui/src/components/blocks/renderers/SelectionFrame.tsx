import React from 'react';
import { cn } from '../../../lib/utils';
import { HandleType } from '../../../hooks/useResizable';

interface SelectionFrameProps {
  size: { width: number, height: number };
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
  onConnectStart: (e: React.PointerEvent) => void;
}

export const SelectionFrame = ({ size, onResizeStart, onConnectStart }: SelectionFrameProps) => {
  return (
    <div 
      className="absolute pointer-events-none"
      style={{
        top: -6,
        left: -6,
        right: -6,
        bottom: -6,
        border: '2px solid hsl(var(--primary))',
        borderRadius: '12px',
        zIndex: 101
      }}
    >
      {/* Corner Handles */}
      {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map(type => (
        <div 
          key={type} 
          className={cn(
            "absolute h-3.5 w-3.5 pointer-events-auto bg-background border-2 border-primary rounded-full shadow-md hover:scale-125 transition-transform",
            type === 'nw' && "-top-2 -left-2 cursor-nw-resize",
            type === 'ne' && "-top-2 -right-2 cursor-ne-resize",
            type === 'sw' && "-bottom-2 -left-2 cursor-sw-resize",
            type === 'se' && "-bottom-2 -right-2 cursor-se-resize"
          )} 
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, type);
          }} 
        />
      ))}
      
      {/* Edge Interaction Zones */}
      {(['n', 's', 'e', 'w'] as HandleType[]).map(type => (
        <div 
          key={type} 
          className={cn(
            "absolute pointer-events-auto",
            type === 'n' && "top-0 left-4 right-4 h-3 -translate-y-1/2 cursor-n-resize",
            type === 's' && "bottom-0 left-4 right-4 h-3 translate-y-1/2 cursor-s-resize",
            type === 'e' && "top-4 bottom-4 right-0 w-3 translate-x-1/2 cursor-e-resize",
            type === 'w' && "top-4 bottom-4 left-0 w-3 -translate-x-1/2 cursor-w-resize"
          )} 
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, type);
          }} 
        />
      ))}

      {/* Connection Handle */}
      <div 
        className="absolute -right-8 top-1/2 -translate-y-1/2 group pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          onConnectStart(e);
        }}
      >
        <div className="h-7 w-7 rounded-full bg-background border-2 border-primary flex items-center justify-center cursor-crosshair shadow-lg group-hover:bg-primary transition-all">
          <div className="w-2.5 h-2.5 rounded-full bg-primary group-hover:bg-background" />
        </div>
      </div>
    </div>
  );
};

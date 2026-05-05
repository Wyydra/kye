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
      className="absolute"
      style={{
        top: -12,
        left: -12,
        right: -12,
        bottom: -12,
        pointerEvents: 'none',
        zIndex: 101
      }}
    >
      {/* Connection Zones (4 sides, hollow center to allow drag-and-drop of the card) */}
      <div className="absolute inset-0 group">
        {/* Top */}
        <div 
          className="absolute top-0 left-4 right-4 h-4 pointer-events-auto cursor-crosshair"
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
        />
        {/* Bottom */}
        <div 
          className="absolute bottom-0 left-4 right-4 h-4 pointer-events-auto cursor-crosshair"
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
        />
        {/* Left */}
        <div 
          className="absolute left-0 top-4 bottom-4 w-4 pointer-events-auto cursor-crosshair"
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
        />
        {/* Right */}
        <div 
          className="absolute right-0 top-4 bottom-4 w-4 pointer-events-auto cursor-crosshair"
          onPointerDown={(e) => { e.stopPropagation(); onConnectStart(e); }}
        />

        {/* Visual indicators on hover */}
        {['top', 'bottom', 'left', 'right'].map(side => (
          <div 
            key={side}
            className={cn(
              "absolute opacity-0 group-hover:opacity-100 transition-opacity bg-primary rounded-full",
              side === 'top' && "top-0 left-1/2 -translate-x-1/2 w-8 h-1.5 -translate-y-1/2",
              side === 'bottom' && "bottom-0 left-1/2 -translate-x-1/2 w-8 h-1.5 translate-y-1/2",
              side === 'left' && "left-0 top-1/2 -translate-y-1/2 h-8 w-1.5 -translate-x-1/2",
              side === 'right' && "right-0 top-1/2 -translate-y-1/2 h-8 w-1.5 translate-x-1/2"
            )}
          />
        ))}
      </div>

      {/* Main Selection Border (Visual Only) */}
      <div 
        className="absolute inset-[10px] border-2 border-primary rounded-lg pointer-events-none shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)]"
      />

      {/* Corner Handles (Resize) */}
      {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map(type => (
        <div 
          key={type} 
          className={cn(
            "absolute h-3.5 w-3.5 pointer-events-auto bg-background border-2 border-primary rounded-sm shadow-md hover:scale-125 transition-transform z-10",
            type === 'nw' && "top-1.5 left-1.5 cursor-nw-resize",
            type === 'ne' && "top-1.5 right-1.5 cursor-ne-resize",
            type === 'sw' && "bottom-1.5 left-1.5 cursor-sw-resize",
            type === 'se' && "bottom-1.5 right-1.5 cursor-se-resize"
          )} 
          onPointerDown={(e) => {
            e.stopPropagation();
            onResizeStart(e, type);
          }} 
        />
      ))}
    </div>
  );
};

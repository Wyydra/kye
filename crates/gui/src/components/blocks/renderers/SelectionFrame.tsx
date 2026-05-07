import React from 'react';
import { HandleType } from '../../../hooks/useResizable';
import { BlockToolbar } from '../interaction/BlockToolbar';
import { ResizeHandles } from '../interaction/ResizeHandles';
import { ConnectionHandles } from '../interaction/ConnectionHandles';
import { BlockFeatures } from './BlockRegistry';

interface SelectionFrameProps {
  size: { width: number, height: number };
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
  onConnectStart: (e: React.PointerEvent) => void;
  onDragStart?: (e: React.PointerEvent) => void;
  onEditStart?: () => void;
  onDelete?: () => void;
  features?: BlockFeatures;
}

/**
 * Unified Selection Coordinator
 * Orchestrates the toolbar, resize handles, and connection points.
 */
export const SelectionFrame = ({ 
  onResizeStart, 
  onConnectStart, 
  onEditStart, 
  onDelete,
  features = { resizable: true, connectable: true, toolbar: true, selectionBorder: true }
}: SelectionFrameProps) => {
  return (
    <div 
      className="absolute"
      style={{
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
        pointerEvents: 'none',
        zIndex: 101
      }}
    >
      {/* 1. Selection Visual Border */}
      {features.selectionBorder && (
        <div className="absolute inset-0 border-2 border-primary/30 rounded-xl" />
      )}

      {/* 2. Floating Action Toolbar (UI) */}
      {features.toolbar && (
        <BlockToolbar 
          onEdit={onEditStart} 
          onDelete={onDelete} 
        />
      )}

      {/* 3. Resize Controls (Interaction) */}
      {features.resizable && (
        <ResizeHandles onResizeStart={onResizeStart} />
      )}

      {/* 4. Connection Controls (Interaction) */}
      {features.connectable && (
        <ConnectionHandles onConnectStart={onConnectStart} />
      )}
    </div>
  );
};

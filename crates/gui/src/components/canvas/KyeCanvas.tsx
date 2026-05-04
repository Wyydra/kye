import React, { memo, useMemo, useRef } from 'react';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { useCamera } from '../../hooks/useCamera';
import { GridBackground } from './GridBackground';
import { Workspace } from '../../types/workspace';
import { KyeNode } from '../nodes/KyeNode';
import '../nodes';

interface KyeCanvasProps {
  workspace: Workspace | null;
}

export const KyeCanvas = memo(function KyeCanvas({ workspace }: KyeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  
  // High-performance camera logic (pan/zoom)
  const { viewport } = useCamera(containerRef, layerRef);
  
  // Selection state from store
  const { selectedNodeId, setSelectedNodeId } = useCanvasStore();

  // Virtualization: Filter blocks to only render those in the viewport
  const visibleBlocks = useMemo(() => {
    if (!workspace) return [];
    
    const container = containerRef.current;
    if (!container) return workspace.blocks;

    // Use current camera ref values for bounds calculation
    const vX1 = -viewport.x / viewport.zoom;
    const vY1 = -viewport.y / viewport.zoom;
    const vX2 = vX1 + container.clientWidth / viewport.zoom;
    const vY2 = vY1 + container.clientHeight / viewport.zoom;

    const buffer = 150; // Increased buffer for smoother rapid panning

    return workspace.blocks.filter(block => {
      let meta;
      try { meta = JSON.parse(block.metadata); } catch { return true; }
      
      const bX1 = meta.x ?? 0;
      const bY1 = meta.y ?? 0;
      const bX2 = bX1 + (meta.width ?? 300);
      const bY2 = bY1 + (meta.height ?? 200);

      return !(bX2 < vX1 - buffer || bX1 > vX2 + buffer || bY2 < vY1 - buffer || bY1 > vY2 + buffer);
    });
  }, [workspace, viewport]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        background: '#121212', 
        overflow: 'hidden',
        cursor: 'default',
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) {
          setSelectedNodeId(null);
        }
      }}
    >
      <GridBackground x={viewport.x} y={viewport.y} zoom={viewport.zoom} />
      
      <div 
        ref={layerRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: 0, 
          height: 0, 
          willChange: 'transform',
        }}
      >
        {visibleBlocks.map((block) => (
          <KyeNode 
            key={block.id} 
            block={block} 
            zoom={viewport.zoom}
            isSelected={selectedNodeId === block.id}
            onSelect={() => setSelectedNodeId(block.id)}
          />
        ))}
      </div>
    </div>
  );
});

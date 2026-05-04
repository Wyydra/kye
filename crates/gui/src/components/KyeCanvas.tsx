import React, { memo, useState, useEffect, useMemo } from 'react';
import { useCanvasEngine } from '../hooks/useCanvasEngine';
import { GridBackground } from './GridBackground';
import { Workspace } from '../types/workspace';
import { KyeNode } from './KyeNode';
import './nodes';

interface KyeCanvasProps {
  workspace: Workspace | null;
}

export const KyeCanvas = memo(function KyeCanvas({ workspace }: KyeCanvasProps) {
  const { containerRef, layerRef, viewportRef } = useCanvasEngine();
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Sync viewport state to React for components that need it (like Grid & Virtualization)
  useEffect(() => {
    let frame: number;
    const sync = () => {
      const { x, y, zoom } = viewportRef.current;
      setViewport(prev => {
        if (prev.x === x && prev.y === y && prev.zoom === zoom) return prev;
        return { x, y, zoom };
      });
      frame = requestAnimationFrame(sync);
    };
    frame = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(frame);
  }, []);

  // Virtualization: Filter blocks to only render those in the viewport
  const visibleBlocks = useMemo(() => {
    if (!workspace) return [];
    
    const container = containerRef.current;
    if (!container) return workspace.blocks;

    const vX1 = -viewport.x / viewport.zoom;
    const vY1 = -viewport.y / viewport.zoom;
    const vX2 = vX1 + container.clientWidth / viewport.zoom;
    const vY2 = vY1 + container.clientHeight / viewport.zoom;

    // Buffer for smoother panning
    const buffer = 100;

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

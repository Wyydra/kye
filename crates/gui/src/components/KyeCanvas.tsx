import React, { memo, useState, useEffect } from 'react';
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

  // Sync viewport state to React for components that need it (like Grid)
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
        {workspace?.blocks.map((block) => (
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

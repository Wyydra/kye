import React, { useMemo } from 'react';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';
import { getBezierPath, getEdgePoint, getBezierMidpoint } from '../../../lib/geometry';
import { cn } from '../../../lib/utils';

/**
 * Unified Connection Renderer (Arrows between blocks)
 */
export const ConnectionRenderer = React.memo(({ block, isSelected, onSelect }: BlockRendererProps) => {
  const nodeStates = useCanvasStore(state => state.nodeStates);

  // Use fields directly
  const fields = block.fields;

  // Normalize node states with defaults to prevent NaN in geometry
  const source = useMemo(() => {
    const s = nodeStates[fields.from];
    if (!s) return null;
    return { x: s.x || 0, y: s.y || 0, width: s.width || 300, height: s.height || 200 };
  }, [nodeStates, fields.from]);

  const target = useMemo(() => {
    const t = nodeStates[fields.to];
    if (!t) return null;
    return { x: t.x || 0, y: t.y || 0, width: t.width || 300, height: t.height || 200 };
  }, [nodeStates, fields.to]);

  const { pathData } = useMemo(() => {
    if (!source || !target) return { pathData: '' };
    
    const p1 = getEdgePoint(source, target);
    const p2 = getEdgePoint(target, source);
    
    // Safety check to prevent NaN paths
    if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
      return { pathData: '' };
    }

    return {
      pathData: getBezierPath(p1, p2)
    };
  }, [source, target]);

  if (!pathData) return null;

  return (
    <g 
      className="group cursor-pointer" 
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {/* Invisible thick path for easier clicking */}
      <path
        d={pathData}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        style={{ pointerEvents: 'auto' }}
      />
      
      {/* Glow effect on hover/select */}
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={isSelected ? "6" : "10"}
        strokeOpacity={isSelected ? "0.2" : "0"}
        className="transition-all duration-500 group-hover:stroke-opacity-10"
        style={{ pointerEvents: 'none' }}
      />

      {/* Main visual path */}
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={isSelected ? "2.5" : "1.5"}
        strokeOpacity={isSelected ? "1" : "0.5"}
        markerEnd="url(#arrowhead)"
        className={cn("transition-all duration-300", isSelected && "drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]")}
        style={{ pointerEvents: 'none' }}
      />

      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" className="fill-primary" />
        </marker>
      </defs>
    </g>
  );
});

// Auto-registration
blockRegistry.register({
  match: (block) => block.shapes.includes('connection'),
  svg: ConnectionRenderer,
  editorMode: 'popup',
  features: {
    resizable: false,
    connectable: false,
    selectionBorder: false
  },
  getAnchor: (block, meta, nodeStates) => {
    const s = nodeStates[meta.from];
    const t = nodeStates[meta.to];
    if (!s || !t) return null;
    const p1 = getEdgePoint(s, t);
    const p2 = getEdgePoint(t, s);
    const mid = getBezierMidpoint(p1, p2);
    return { 
      x: mid.x - 50, 
      y: mid.y - 12,
      width: 100,
      height: 24
    };
  }
});

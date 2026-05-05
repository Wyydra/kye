import React, { useMemo } from 'react';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';

interface Point {
  x: number;
  y: number;
}

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// We use the unified BlockRendererProps for consistency

/**
 * Calculates the point on the rectangle boundary that is on the line between source and target centers.
 */
function getEdgePoint(source: NodeRect, target: NodeRect): Point {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;
  
  if (dx === 0 && dy === 0) return sc;

  const widthHalf = source.width / 2;
  const heightHalf = source.height / 2;

  // Slope
  const m = dy / dx;

  // We check which side of the rectangle the line intersects
  if (Math.abs(m) <= heightHalf / widthHalf) {
    // Intersects left or right side
    const x = dx > 0 ? widthHalf : -widthHalf;
    return { x: sc.x + x, y: sc.y + x * m };
  } else {
    // Intersects top or bottom side
    const y = dy > 0 ? heightHalf : -heightHalf;
    return { x: sc.x + y / m, y: sc.y + y };
  }
}

export const LinkRenderer = React.memo(({ block, isSelected, isEditing, setIsEditing, onSelect, onRefresh }: BlockRendererProps) => {
  const nodeStates = useCanvasStore(state => state.nodeStates);

  const meta = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  const source = nodeStates[meta.from];
  const target = nodeStates[meta.to];

  const { pathData, midPoint } = useMemo(() => {
    if (!source || !target) return { pathData: '', midPoint: { x: 0, y: 0 } };
    
    const p1 = getEdgePoint(source, target);
    const p2 = getEdgePoint(target, source);

    const dx = Math.abs(p2.x - p1.x);
    const curvature = Math.max(dx * 0.5, 40);
    
    const cp1x = p1.x + (p2.x > p1.x ? curvature : -curvature);
    const cp2x = p2.x - (p2.x > p1.x ? curvature : -curvature);

    const midX = (p1.x + cp1x + cp2x + p2.x) / 4;
    const midY = (p1.y + p1.y + p2.y + p2.y) / 4;

    return {
      pathData: `M ${p1.x} ${p1.y} C ${cp1x} ${p1.y}, ${cp2x} ${p2.y}, ${p2.x} ${p2.y}`,
      midPoint: { x: midX, y: midY }
    };
  }, [source, target]);

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
      
      {/* Visual path */}
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={isSelected ? "3" : "2"}
        strokeOpacity={isSelected ? "1" : "0.5"}
        markerEnd="url(#arrowhead)"
        className="transition-all"
        style={{ pointerEvents: 'none' }}
      />

      {/* Label / Mini-Node */}
      <g 
        transform={`translate(${midPoint.x}, ${midPoint.y})`}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
        className="cursor-pointer"
        style={{ pointerEvents: 'auto' }}
      >
        <rect
          x="-45" y="-10" width="90" height="20"
          rx="4"
          fill="hsl(var(--background))"
          stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
          strokeWidth={isSelected ? "2" : "1"}
          className="shadow-sm transition-all"
        />
        
        {/* Standard Label View (always shown when not editing, or always shown with the editor on top) */}
        {!isEditing && (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--foreground))"
            className="select-none pointer-events-none"
            style={{ fontSize: '11px', fontWeight: isSelected ? 'bold' : 'normal' }}
          >
            {block.content || 'Add label...'}
          </text>
        )}
      </g>
    </g>
  );
});

// Auto-registration
blockRegistry.register({
  priority: 10,
  match: (_, meta) => !!(meta.from && meta.to),
  svg: LinkRenderer,
  editorMode: 'popup',
  getAnchor: (block, meta, nodeStates) => {
    const s = nodeStates[meta.from];
    const t = nodeStates[meta.to];
    if (!s || !t) return null;
    return { 
      x: (s.x + s.width/2 + t.x + t.width/2) / 2 - 50, 
      y: (s.y + s.height/2 + t.y + t.height/2) / 2 - 12,
      width: 100,
      height: 24
    };
  }
});

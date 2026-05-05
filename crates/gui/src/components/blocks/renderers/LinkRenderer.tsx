import React, { useMemo } from 'react';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';
import { getBezierPath, getEdgePoint, getBezierMidpoint } from '../../../lib/geometry';

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

    return {
      pathData: getBezierPath(p1, p2),
      midPoint: getBezierMidpoint(p1, p2)
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
      
      {/* Visual path */}
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth={isSelected ? "3" : "2"}
        strokeOpacity={isSelected ? "1" : "0.5"}
        markerEnd="url(#arrowhead)"
        className={cn("transition-all", isSelected && "drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]")}
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
        
        {!isEditing && (
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--foreground))"
            className="select-none pointer-events-none"
            style={{ fontSize: '10px', fontWeight: isSelected ? 'bold' : 'normal' }}
          >
            {block.content || 'Add label...'}
          </text>
        )}
      </g>
    </g>
  );
});

// Helper for classNames (simple version since we don't have clsx in this file scope if not imported)
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}

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

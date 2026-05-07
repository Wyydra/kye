import React, { useMemo } from 'react';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';
import { getBezierPath, getEdgePoint, getBezierMidpoint } from '../../../lib/geometry';
import { cn } from '../../../lib/utils';

/**
 * Unified Connection Renderer (Arrows between blocks)
 */
export const ConnectionRenderer = React.memo(({ block, isSelected, isEditing, setIsEditing, onSelect }: BlockRendererProps) => {
  const nodeStates = useCanvasStore(state => state.nodeStates);

  const meta = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  // Support both meta.label and block.content (for backward compat)
  const label = meta.label || block.content;
  const source = nodeStates[meta.from];
  const target = nodeStates[meta.to];

  const { pathData, midPoint, angle } = useMemo(() => {
    if (!source || !target) return { pathData: '', midPoint: { x: 0, y: 0 }, angle: 0 };
    
    const p1 = getEdgePoint(source, target);
    const p2 = getEdgePoint(target, source);

    // Calculate angle for better label orientation (optional)
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;

    return {
      pathData: getBezierPath(p1, p2),
      midPoint: getBezierMidpoint(p1, p2),
      angle
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

      {/* Label Badge */}
      {label && (
        <g 
          transform={`translate(${midPoint.x}, ${midPoint.y})`}
          className="cursor-pointer"
          style={{ pointerEvents: 'auto' }}
        >
          {/* Glassmorphism Background */}
          <rect
            x="-45" y="-10" width="90" height="20"
            rx="10"
            fill="var(--background)"
            fillOpacity="0.8"
            stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--border))"}
            strokeWidth={isSelected ? "1.5" : "1"}
            className="shadow-lg backdrop-blur-md transition-all duration-300"
          />
          
          {/* Label text */}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill={isSelected ? "hsl(var(--primary))" : "hsl(var(--foreground))"}
            className="select-none pointer-events-none transition-colors"
            style={{ 
              fontSize: '8px', 
              fontWeight: '900',
              textTransform: 'uppercase',
              letterSpacing: '0.15em'
            }}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
});

// Auto-registration
blockRegistry.register({
  priority: 200, 
  match: (block, meta) => block.shapes.includes('connection') || (!!meta.from && !!meta.to),
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

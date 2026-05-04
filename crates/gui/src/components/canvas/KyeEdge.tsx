import React, { useMemo } from 'react';

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

interface KyeEdgeProps {
  id: string;
  source?: NodeRect;
  target?: NodeRect;
  content: string;
}

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

export const KyeEdge = React.memo(({ source, target, content }: KyeEdgeProps) => {
  const { pathData, midPoint } = useMemo(() => {
    if (!source || !target) return { pathData: '', midPoint: { x: 0, y: 0 } };

    // Anchor points at the boundaries of the nodes
    const p1 = getEdgePoint(source, target);
    const p2 = getEdgePoint(target, source);

    const dx = Math.abs(p2.x - p1.x);
    const curvature = Math.max(dx * 0.5, 40);
    
    const cp1x = p1.x + (p2.x > p1.x ? curvature : -curvature);
    const cp2x = p2.x - (p2.x > p1.x ? curvature : -curvature);

    // Calculate midpoint on the curve for the label
    // Simplified: use the average of control points and anchors
    const midX = (p1.x + cp1x + cp2x + p2.x) / 4;
    const midY = (p1.y + p1.y + p2.y + p2.y) / 4;

    return {
      pathData: `M ${p1.x} ${p1.y} C ${cp1x} ${p1.y}, ${cp2x} ${p2.y}, ${p2.x} ${p2.y}`,
      midPoint: { x: midX, y: midY }
    };
  }, [source, target]);

  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeOpacity="0.8"
        markerEnd="url(#arrowhead)"
        style={{ transition: 'stroke 0.2s' }}
      />
      {content && (
        <g transform={`translate(${midPoint.x}, ${midPoint.y})`}>
          <rect
            x="-40"
            y="-10"
            width="80"
            height="20"
            rx="4"
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth="1"
            style={{ opacity: 0.8 }}
          />
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fill="hsl(var(--foreground))"
            style={{ fontSize: '10px', fontWeight: 'bold' }}
          >
            {content.length > 15 ? content.substring(0, 12) + '...' : content}
          </text>
        </g>
      )}
    </g>
  );
});

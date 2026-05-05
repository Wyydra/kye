export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates the intersection point on a rectangle boundary towards a target point or another rectangle.
 */
export function getEdgePoint(source: Rect, target: Rect | Point): Point {
  const sc = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const tc = 'width' in target 
    ? { x: target.x + target.width / 2, y: target.y + target.height / 2 }
    : target;
  
  const dx = tc.x - sc.x;
  const dy = tc.y - sc.y;
  
  if (dx === 0 && dy === 0) return sc;

  const widthHalf = source.width / 2;
  const heightHalf = source.height / 2;

  const m = dy / dx;

  if (Math.abs(m) <= heightHalf / widthHalf) {
    const x = dx > 0 ? widthHalf : -widthHalf;
    return { x: sc.x + x, y: sc.y + x * m };
  } else {
    const y = dy > 0 ? heightHalf : -heightHalf;
    return { x: sc.x + y / m, y: sc.y + y };
  }
}

/**
 * Generates a cubic bezier path between two points with automatic curvature.
 */
export function getBezierPath(p1: Point, p2: Point): string {
  const dx = Math.abs(p2.x - p1.x);
  const curvature = Math.max(dx * 0.5, 40);
  
  const cp1x = p1.x + (p2.x > p1.x ? curvature : -curvature);
  const cp2x = p2.x - (p2.x > p1.x ? curvature : -curvature);

  return `M ${p1.x} ${p1.y} C ${cp1x} ${p1.y}, ${cp2x} ${p2.y}, ${p2.x} ${p2.y}`;
}

/**
 * Calculates the midpoint of a cubic bezier curve for label placement.
 */
export function getBezierMidpoint(p1: Point, p2: Point): Point {
  const dx = Math.abs(p2.x - p1.x);
  const curvature = Math.max(dx * 0.5, 40);
  
  const cp1x = p1.x + (p2.x > p1.x ? curvature : -curvature);
  const cp2x = p2.x - (p2.x > p1.x ? curvature : -curvature);

  // Simple approximation of the midpoint for a cubic bezier
  return {
    x: (p1.x + cp1x + cp2x + p2.x) / 4,
    y: (p1.y + p1.y + p2.y + p2.y) / 4
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Calculates the visible world rectangle based on viewport state and container dimensions.
 */
export function getVisibleWorldRect(
  viewport: ViewportState,
  containerWidth: number,
  containerHeight: number,
  margin: number = 200
): Rect {
  const zoom = Math.max(viewport.zoom, 0.01);
  const minX = (-viewport.x - margin) / zoom;
  const minY = (-viewport.y - margin) / zoom;
  const width = (containerWidth + margin * 2) / zoom;
  const height = (containerHeight + margin * 2) / zoom;

  return { x: minX, y: minY, width, height };
}

/**
 * Returns true if a spatial node rect intersects with the visible world rectangle.
 */
export function isRectVisible(nodeRect: Rect, visibleWorldRect: Rect): boolean {
  return !(
    nodeRect.x + nodeRect.width < visibleWorldRect.x ||
    nodeRect.x > visibleWorldRect.x + visibleWorldRect.width ||
    nodeRect.y + nodeRect.height < visibleWorldRect.y ||
    nodeRect.y > visibleWorldRect.y + visibleWorldRect.height
  );
}

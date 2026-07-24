import React, { useMemo } from "react";
import { CanvasNode } from "../renderers/layouts/CanvasNode";
import { ConnectionOverlay } from "../renderers/layouts/ConnectionOverlay";
import { useGraphStore } from "../../store/graphStore";
import { val } from "../../types/domain";
import { isRectVisible, Rect } from "../../lib/viewport";

interface NodeLayerProps {
  contentIds: string[];
  connectionIds: string[];
  depth: number;
  visibleWorldRect: Rect | null;
}

export const NodeLayer: React.FC<NodeLayerProps> = React.memo(function NodeLayer({
  contentIds,
  connectionIds,
  depth,
  visibleWorldRect,
}) {
  const nodes = useGraphStore((state) => state.nodes);

  // Perform spatial viewport culling: filter out nodes outside current screen view
  const visibleContentIds = useMemo(() => {
    if (!visibleWorldRect) return contentIds;

    return contentIds.filter((id) => {
      const node = nodes[id];
      if (!node) return false;

      const x = val<number>(node.props["x"]) || 0;
      const y = val<number>(node.props["y"]) || 0;
      const width = val<number>(node.props["width"]) || 300;
      const height = val<number>(node.props["height"]) || 200;

      return isRectVisible({ x, y, width, height }, visibleWorldRect);
    });
  }, [contentIds, nodes, visibleWorldRect]);

  return (
    <div className="absolute inset-0">
      {visibleContentIds.map((id) => (
        <CanvasNode key={id} nodeId={id} depth={depth + 1} />
      ))}
      {connectionIds.map((id) => (
        <ConnectionOverlay key={id} connectionId={id} />
      ))}
    </div>
  );
});

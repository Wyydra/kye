import React, { useMemo } from "react";
import { useGraphStore } from "../../store/graphStore";
import { CanvasConnection } from "../renderers/layouts/CanvasConnection";
import { getBezierPath } from "../../lib/geometry";
import { val } from "../../types/domain";

interface ConnectionDraftState {
  sourceId: string;
  targetId: string | null;
  currentX: number;
  currentY: number;
}

interface EdgeLayerProps {
  connectionIds: string[];
  connectionDraft: ConnectionDraftState | null;
}

export const EdgeLayer: React.FC<EdgeLayerProps> = React.memo(function EdgeLayer({
  connectionIds,
  connectionDraft,
}) {
  const nodes = useGraphStore((state) => state.nodes);

  const draftPath = useMemo(() => {
    if (!connectionDraft) return null;
    const sourceNode = nodes[connectionDraft.sourceId];
    if (!sourceNode) return null;

    const x1 = val<number>(sourceNode.props["x"]) || 0;
    const y1 = val<number>(sourceNode.props["y"]) || 0;
    const width = val<number>(sourceNode.props["width"]) || 300;
    const height = val<number>(sourceNode.props["height"]) || 200;

    const startX = x1 + width / 2;
    const startY = y1 + height / 2;

    return getBezierPath(
      { x: startX, y: startY },
      { x: connectionDraft.currentX, y: connectionDraft.currentY }
    );
  }, [connectionDraft, nodes]);

  return (
    <svg className="absolute inset-0 w-[100000px] h-[100000px] -translate-x-[50000px] -translate-y-[50000px] pointer-events-none overflow-visible">
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" fillOpacity="0.6" />
        </marker>
      </defs>
      <g transform="translate(50000, 50000)">
        {connectionIds.map((id) => (
          <CanvasConnection key={id} connectionId={id} />
        ))}
        {draftPath && (
          <path
            d={draftPath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeDasharray="4 4"
            strokeOpacity="0.8"
            markerEnd="url(#arrowhead)"
          />
        )}
      </g>
    </svg>
  );
});

import React, { useMemo } from "react";
import { useGraphStore } from "../../../store/graphStore";
import { useCanvasStore } from "../../../store/canvasStore";
import { getBezierPath } from "../../../lib/geometry";

interface CanvasConnectionProps {
  connectionId: string;
}

export const CanvasConnection: React.FC<CanvasConnectionProps> = ({ connectionId }) => {
  const connection = useGraphStore(state => state.nodes[connectionId]);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  const { selectedNodeId, setSelectedNodeId } = useCanvasStore();

  const isSelected = selectedNodeId === connectionId;

  const { path } = useMemo(() => {
    if (!connection || connection.kind !== "core.connection") return { path: null, midPoint: null };

    const fromId = connection.props["from"]?.v as string;
    const toId = connection.props["to"]?.v as string;

    const source = nodeStates[fromId];
    const target = nodeStates[toId];

    if (!source || !target) return { path: null, midPoint: null };

    // Anchor points (center of nodes)
    const p1 = {
      x: source.x + source.width / 2,
      y: source.y + source.height / 2
    };
    const p2 = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2
    };

    return { path: getBezierPath(p1, p2) };
  }, [connection, nodeStates]);

  if (!path) return null;

  return (
    <g className="animate-in fade-in duration-500">
      <path
        d={path}
        fill="none"
        stroke={isSelected ? "hsl(var(--primary))" : "hsl(var(--primary))"}
        strokeWidth={isSelected ? "3" : "2"}
        strokeOpacity={isSelected ? "1" : "0.3"}
        markerEnd="url(#arrowhead)"
        className="transition-colors duration-300"
      />
      {/* Invisible thicker path for easier hovering/interaction */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth="20"
        className="cursor-pointer pointer-events-auto"
        onPointerDown={(e) => {
          e.stopPropagation();
          setSelectedNodeId(connectionId);
        }}
      />
    </g>
  );
};

import React, { useMemo } from 'react';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { getBezierPath, getEdgePoint } from '../../lib/geometry';

export const DraftLink = () => {
  const connectionDraft = useCanvasStore(state => state.connectionDraft);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  const hoveredNodeId = useCanvasStore(state => state.hoveredNodeId);

  const pathData = useMemo(() => {
    if (!connectionDraft) return '';

    const source = nodeStates[connectionDraft.sourceId];
    if (!source) return '';

    const targetNode = hoveredNodeId ? nodeStates[hoveredNodeId] : null;
    
    if (targetNode && hoveredNodeId !== connectionDraft.sourceId) {
      const start = getEdgePoint(source, targetNode);
      const end = getEdgePoint(targetNode, source);
      return getBezierPath(start, end);
    } else {
      const end = { x: connectionDraft.mouseX, y: connectionDraft.mouseY };
      const start = getEdgePoint(source, end);
      return getBezierPath(start, end);
    }
  }, [connectionDraft, nodeStates, hoveredNodeId]);

  if (!connectionDraft || !pathData) return null;

  return (
    <g style={{ pointerEvents: 'none' }}>
      <path
        d={pathData}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeDasharray="4 4"
        strokeOpacity="0.6"
        markerEnd="url(#arrowhead)"
      />
    </g>
  );
};

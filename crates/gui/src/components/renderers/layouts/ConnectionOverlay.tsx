import React, { useMemo, useCallback } from "react";
import { useGraphStore } from "../../../store/graphStore";
import { useCanvasStore } from "../../../store/canvasStore";
import { val } from "../../../types/domain";
import { BlockToolbar } from "./BlockToolbar";
import { execute } from "../../../lib/commands";
import { useUIStore } from "../../../store/uiStore";
import { getBezierMidpoint } from "../../../lib/geometry";

interface ConnectionOverlayProps {
  connectionId: string;
}

export const ConnectionOverlay: React.FC<ConnectionOverlayProps> = ({ connectionId }) => {
  const connection = useGraphStore(state => state.nodes[connectionId]);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  const { selectedNodeId, setSelectedNodeId } = useCanvasStore();
  const setModalNodeId = useUIStore(state => state.setModalNodeId);

  const isSelected = selectedNodeId === connectionId;
  const isLocked = !!val<boolean>(connection?.props["is_locked"]);

  const titleProp = connection?.props["title"];
  const title = titleProp?.t === "Text" ? titleProp.v : undefined;

  // Compute exact bezier midpoint
  const midPoint = useMemo(() => {
    if (!connection || connection.kind !== "core.connection") return null;

    const fromId = val<string>(connection.props["from"]);
    const toId = val<string>(connection.props["to"]);

    if (!fromId || !toId) return null;

    const source = nodeStates[fromId];
    const target = nodeStates[toId];

    if (!source || !target) return null;

    const p1 = {
      x: source.x + source.width / 2,
      y: source.y + source.height / 2
    };
    const p2 = {
      x: target.x + target.width / 2,
      y: target.y + target.height / 2
    };

    return getBezierMidpoint(p1, p2);
  }, [connection, nodeStates]);

  // Handlers
  const handleEdit = useCallback(() => setModalNodeId(connectionId), [connectionId, setModalNodeId]);
  
  const handleDelete = useCallback(() => {
    execute({ type: "delete_node", id: connectionId, cascade: false });
    setSelectedNodeId(null);
  }, [connectionId, setSelectedNodeId]);
  
  const handleToggleLock = useCallback(() => {
    execute({
      type: "set_prop",
      node_id: connectionId,
      key: "is_locked",
      value: { t: "Bool", v: !isLocked }
    });
  }, [connectionId, isLocked]);

  if (!midPoint || (!isSelected && !title)) return null;

  return (
    <div 
      className="absolute z-40 pointer-events-none flex flex-col items-center justify-center"
      style={{
        left: midPoint.x,
        top: midPoint.y,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Title Label */}
      {title && (
        <div className={`pointer-events-auto bg-background/90 backdrop-blur border shadow-sm rounded-md px-2 py-1 flex items-center justify-center transition-all ${isSelected ? 'border-primary/50 ring-2 ring-primary/20' : 'border-border'}`}>
          <span className="text-xs text-muted-foreground font-medium max-w-[150px] truncate">{title}</span>
        </div>
      )}

      {/* Action Toolbar */}
      {isSelected && (
        <div className="relative mt-2 pointer-events-auto">
          <BlockToolbar
            isLocked={isLocked}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleLock={handleToggleLock}
          />
        </div>
      )}
    </div>
  );
};

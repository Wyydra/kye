import React from "react";
import { HandleType } from "../../../hooks/useResizable";
import { ResizeHandles } from "./ResizeHandles";
import { ConnectionHandles } from "./ConnectionHandles";
import { BlockToolbar } from "./BlockToolbar";
import { execute } from "../../../lib/commands";
import { useUIStore } from "../../../store/uiStore";
import { useGraphStore } from "../../../store/graphStore";
import { useCanvasStore } from "../../../store/canvasStore";
import { val, extractTextFromValue } from "../../../types/domain";

interface SelectionFrameProps {
  nodeId: string;
  isLocked?: boolean;
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
  onConnectStart: (e: React.PointerEvent, side: string) => void;
  onToggleLock: () => void;
}

export const SelectionFrame: React.FC<SelectionFrameProps> = ({
  nodeId,
  isLocked,
  onResizeStart,
  onConnectStart,
  onToggleLock,
}) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const handleDelete = () => {
    execute({ type: "delete_node", id: nodeId, cascade: true });
    setSelectedNodeId(null);
  };

  const handleDuplicate = () => {
    if (!node) return;
    const newId = crypto.randomUUID();
    const currentX = val<number>(node.props.x) || 0;
    const currentY = val<number>(node.props.y) || 0;
    const title = extractTextFromValue(node.props.title) || "Untitled";

    const duplicateProps = {
      ...node.props,
      x: { t: "Float" as const, v: currentX + 30 },
      y: { t: "Float" as const, v: currentY + 30 },
      title: { t: "Text" as const, v: `${title} (Copy)` },
    };

    execute({
      type: "create_node",
      id: newId,
      kind: node.kind,
      parent_id: node.parent,
      index: 0,
      props: duplicateProps,
    });
    setSelectedNodeId(newId);
  };

  return (
    <div
      className="absolute pointer-events-none z-[100]"
      style={{
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
      }}
    >
      {/* Selection Border Ring */}
      <div
        className={`absolute inset-0 border-2 rounded-xl ring-4 animate-in fade-in zoom-in-95 duration-150 ${
          isLocked
            ? "border-amber-500/40 ring-amber-500/10"
            : "border-primary/40 ring-primary/10"
        }`}
      />

      {/* Action Toolbar */}
      <BlockToolbar
        isLocked={isLocked}
        onToggleLock={onToggleLock}
        onEdit={() => useUIStore.getState().openBuffer(nodeId)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />

      {/* Resize Handles */}
      {!isLocked && <ResizeHandles onResizeStart={onResizeStart} />}

      {/* Connection Handles */}
      <ConnectionHandles onConnectStart={onConnectStart} />
    </div>
  );
};

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Lock } from "lucide-react";
import { NodeRenderer } from "../NodeRenderer";
import { useGraphStore } from "../../../store/graphStore";
import { execute } from "../../../lib/commands";
import { useCanvasStore } from "../../../store/canvasStore";
import { val } from "../../../types/domain";
import { useResizable } from "../../../hooks/useResizable";
import { SelectionFrame } from "./SelectionFrame";

interface CanvasNodeProps {
  nodeId: string;
  depth: number;
}

export const CanvasNode: React.FC<CanvasNodeProps> = ({ nodeId, depth }) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const { 
    selectedNodeId, 
    setSelectedNodeId, 
    updateNodeState,
    viewport 
  } = useCanvasStore();

  if (!node) return null;

  const isSelected = selectedNodeId === nodeId;

  const [localPos, setLocalPos] = useState({
    x: val<number>(node.props["x"]) || 0,
    y: val<number>(node.props["y"]) || 0,
  });
  const [localSize, setLocalSize] = useState({
    width: val<number>(node.props["width"]) || 300,
    height: val<number>(node.props["height"]) || 200,
  });

  const isInteracting = useRef(false);

  useEffect(() => {
    updateNodeState(nodeId, { ...localPos, ...localSize });
  }, [nodeId, localPos, localSize, updateNodeState]);

  useEffect(() => {
    if (!isInteracting.current) {
      setLocalPos({
        x: val<number>(node.props["x"]) || 0,
        y: val<number>(node.props["y"]) || 0,
      });
      setLocalSize({
        width: val<number>(node.props["width"]) || 300,
        height: val<number>(node.props["height"]) || 200,
      });
    }
  }, [node.props]);

  const isLocked = !!val<boolean>(node.props["is_locked"]);

  const handleToggleLock = useCallback(() => {
    execute({
      type: "set_prop",
      node_id: nodeId,
      key: "is_locked",
      value: { t: "Bool", v: !isLocked },
    });
  }, [nodeId, isLocked]);

  const { startResizing } = useResizable(
    viewport.zoom,
    localSize,
    setLocalSize,
    localPos,
    setLocalPos,
    (finalPos, finalSize) => {
      isInteracting.current = false;
      execute({
        type: "set_props",
        node_id: nodeId,
        props: {
          x: { t: "Float", v: Math.round(finalPos.x) },
          y: { t: "Float", v: Math.round(finalPos.y) },
          width: { t: "Float", v: Math.round(finalSize.width) },
          height: { t: "Float", v: Math.round(finalSize.height) },
        },
      });
    }
  );

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;

    setSelectedNodeId(nodeId);

    if (isLocked) return;

    const target = e.target as HTMLElement;
    if (target.closest("input, button, [contenteditable], .interactive-handle")) return;

    e.stopPropagation();
    isInteracting.current = true;

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...localPos };

    let currentX = startPos.x;
    let currentY = startPos.y;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / viewport.zoom;
      const dy = (moveEvent.clientY - startY) / viewport.zoom;
      currentX = Math.round(startPos.x + dx);
      currentY = Math.round(startPos.y + dy);
      setLocalPos({ x: currentX, y: currentY });
    };

    const onPointerUp = () => {
      isInteracting.current = false;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);

      execute({
        type: "set_props",
        node_id: nodeId,
        props: {
          x: { t: "Float", v: currentX },
          y: { t: "Float", v: currentY },
        },
      });
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }, [localPos, nodeId, setSelectedNodeId, viewport.zoom]);

  const onConnectStart = useCallback((e: React.PointerEvent, _side: string) => {
    const { x, y, zoom } = viewport;
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = (rect.left + rect.width / 2 - x) / zoom;
    const worldY = (rect.top + rect.height / 2 - y) / zoom;

    useCanvasStore.getState().setConnectionDraft({
      sourceId: nodeId,
      targetId: null,
      currentX: worldX,
      currentY: worldY
    });
  }, [nodeId, viewport]);

  return (
    <div
      className={`absolute kye-canvas-node bg-background border border-border shadow-sm rounded-lg flex flex-col ${
        isSelected ? "z-30" : "z-10"
      }`}
      style={{
        left: 0,
        top: 0,
        width: Math.round(localSize.width),
        height: Math.round(localSize.height),
        transform: `translate3d(${Math.round(localPos.x)}px, ${Math.round(localPos.y)}px, 0px)`,
      }}
      onPointerDown={handlePointerDown}
      data-node-id={nodeId}
    >
      {}
      <div className={`p-2 border-b border-border flex items-center justify-between shrink-0 ${
        isLocked ? "bg-orange-50/50 cursor-default" : "bg-muted/30 cursor-grab active:cursor-grabbing"
      }`}>
         <div className="flex items-center gap-2">
           {isLocked ? (
             <div className="w-4 h-4 flex items-center justify-center">
                <Lock className="w-3 h-3 text-orange-500" />
             </div>
           ) : (
             <div className={`w-2 h-2 rounded-full ${isSelected ? "bg-primary animate-pulse" : "bg-primary/50"}`} />
           )}
           <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider select-none">
             {node.kind.split(".").pop()}
           </span>
         </div>
      </div>

      {}
      <div className="flex-1 relative overflow-hidden rounded-lg flex flex-col w-full h-full">
        <NodeRenderer nodeId={nodeId} depth={depth} />

        {}
        {(!isSelected || isLocked) && (
          <div className="absolute inset-0 z-10" />
        )}
      </div>

      {}
      {isSelected && (
        <SelectionFrame 
          nodeId={nodeId}
          isLocked={isLocked}
          onResizeStart={startResizing}
          onConnectStart={onConnectStart}
          onToggleLock={handleToggleLock}
        />
      )}
    </div>
  );
};

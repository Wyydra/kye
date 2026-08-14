import React, { useState } from "react";
import { Plus, GripVertical } from "lucide-react";
import { useGraphStore } from "../../../store/graphStore";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { Node } from "../../../types/domain";
import { useBlockDrag } from "../../../hooks/useBlockDrag";
import { BlockContextMenu } from "../../ui/BlockContextMenu";

interface BlockWrapperProps {
  node: Node;
  depth: number;
  children: React.ReactNode;
}

export const BlockWrapper: React.FC<BlockWrapperProps> = React.memo(({ node, depth, children }) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const { setFocusedNode } = useUIStore();
  const focusedNodeId = useUIStore((state) => state.focusedNodeId);
  const isFocused = focusedNodeId === node.id;

  const { dragState, handleDragStart, handleDragOver, handleDragLeave, handleDrop } = useBlockDrag(node);

  const handleAddBelow = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parentNode = useGraphStore.getState().nodes[node.parent || ""];
    if (!parentNode) return;
    const index = parentNode.children.indexOf(node.id);

    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: "core.paragraph",
      parent_id: node.parent,
      index: index + 1,
      props: {
        body: { t: "Rich", v: { spans: [] } },
      },
    });
    setFocusedNode(newId);
  };

  const showGutter = node.parent !== null || depth > 0;

  return (
    <div
      className={`group/block relative w-full transition-all duration-150 rounded-sm flex items-start ${
        isFocused ? "bg-muted/10" : ""
      }`}
      data-node-id={node.id}
      data-kind={node.kind}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenuPos({ x: e.clientX, y: e.clientY });
      }}
      onDragOver={showGutter ? handleDragOver : undefined}
      onDragLeave={showGutter ? handleDragLeave : undefined}
      onDrop={showGutter ? handleDrop : undefined}
    >
      {/* Drop Insertion Line */}
      {dragState === "top" && (
        <div className="absolute -top-0.5 left-0 right-0 h-1 bg-primary rounded-full z-50 pointer-events-none shadow-xs" />
      )}
      {dragState === "bottom" && (
        <div className="absolute -bottom-0.5 left-0 right-0 h-1 bg-primary rounded-full z-50 pointer-events-none shadow-xs" />
      )}

      {/* Notion-Style Left Gutter Handles */}
      {showGutter && (
        <div className="absolute -left-10 top-1.5 flex items-center gap-0.5 opacity-0 group-hover/block:opacity-100 transition-opacity duration-150 z-20">
          <button
            onClick={handleAddBelow}
            className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 rounded transition-colors cursor-pointer"
            title="Click to add a block below"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenuPos({ x: rect.right, y: rect.bottom });
            }}
            draggable
            onDragStart={handleDragStart}
            className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 rounded cursor-grab active:cursor-grabbing transition-colors select-none"
            title="Drag to move • Click for options (Right-click)"
          >
            <GripVertical className="w-3.5 h-3.5 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Main Block Content */}
      <div className="flex-1 min-w-0">{children}</div>

      {/* Universal & Programmable Block Context Menu */}
      <BlockContextMenu
        isOpen={!!contextMenuPos}
        x={contextMenuPos?.x ?? 0}
        y={contextMenuPos?.y ?? 0}
        nodeId={node.id}
        onClose={() => setContextMenuPos(null)}
      />
    </div>
  );
});


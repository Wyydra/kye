import React, { useState } from "react";
import { Plus, GripVertical, ChevronRight } from "lucide-react";
import { useGraphStore } from "../../../store/graphStore";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { Node, val } from "../../../types/domain";
import { useBlockDrag } from "../../../hooks/useBlockDrag";
import { useBlockKeyDown } from "../../../hooks/useBlockKeyDown";
import { BlockContextMenu } from "../../ui/BlockContextMenu";
import { cn } from "../../../lib/utils";

interface BlockWrapperProps {
  node: Node;
  depth: number;
  children: React.ReactNode;
}

export const BlockWrapper: React.FC<BlockWrapperProps> = React.memo(({ node, depth, children }) => {
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);

  const setFocusedNode = useUIStore((state) => state.setFocusedNode);
  const focusedNodeId = useUIStore((state) => state.focusedNodeId);
  const isFocused = focusedNodeId === node.id;

  const isMediaOrCard =
    node.kind === "core.image" ||
    node.kind === "core.file" ||
    node.kind === "core.asset" ||
    node.kind === "core.flashcard" ||
    node.kind === "core.binary";

  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = !!val<boolean>(node.props.is_collapsed);

  const { dragState, handleDragStart, handleDragOver, handleDragLeave, handleDrop } = useBlockDrag(node);
  const handleBlockKeyDown = useBlockKeyDown({ node });

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

  const handleToggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    execute({
      type: "set_prop",
      node_id: node.id,
      key: "is_collapsed",
      value: { t: "Bool", v: !isCollapsed },
    });
  };

  const showGutter = node.parent !== null || depth > 0;

  return (
    <div
      tabIndex={isMediaOrCard ? 0 : undefined}
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("button, [contenteditable], input, textarea")) {
          setFocusedNode(node.id);
        }
      }}
      onKeyDown={isMediaOrCard ? handleBlockKeyDown : undefined}
      className={cn(
        "group/block relative w-full rounded-xl flex items-start outline-none transition-all duration-150",
        isFocused && isMediaOrCard && "ring-2 ring-primary/60 rounded-xl"
      )}
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

      {/* Notion-Style Left Gutter Handles - Strictly placed outside the block */}
      {showGutter && (
        <div
          className={cn(
            "absolute right-full top-0.5 mr-2.5 flex items-center gap-0.5 transition-opacity duration-150 z-20 select-none whitespace-nowrap",
            isCollapsed && hasChildren ? "opacity-100" : "opacity-0 group-hover/block:opacity-100"
          )}
        >
          {/* Universal Toggle Chevron for ANY block with children */}
          {hasChildren && (
            <button
              onClick={handleToggleCollapse}
              className="p-1 text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 rounded transition-colors cursor-pointer"
              title={isCollapsed ? `Expand ${node.children.length} sub-blocks` : "Collapse sub-tree"}
            >
              <ChevronRight
                className={cn(
                  "w-3.5 h-3.5 transition-transform duration-150",
                  !isCollapsed && "rotate-90"
                )}
              />
            </button>
          )}

          {/* Add block below button */}
          <button
            onClick={handleAddBelow}
            className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted/80 rounded transition-colors cursor-pointer"
            title="Click to add a block below"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Drag Grip Handle */}
          <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              setFocusedNode(node.id);
              const rect = e.currentTarget.getBoundingClientRect();
              setContextMenuPos({ x: rect.right, y: rect.bottom });
            }}
            draggable
            onDragStart={handleDragStart}
            className="p-1 text-muted-foreground/50 hover:text-foreground hover:bg-muted/80 rounded cursor-grab active:cursor-grabbing transition-colors select-none"
            title="Drag to move • Click for options"
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

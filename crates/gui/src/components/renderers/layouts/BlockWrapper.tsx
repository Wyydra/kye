import React, { useState, useRef } from "react";
import { Plus, GripVertical, Trash2, Copy } from "lucide-react";
import { useGraphStore } from "../../../store/graphStore";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { useEditor } from "../../../context/EditorContext";
import { convertBlockType } from "../../../extensions/registry";
import { Node } from "../../../types/domain";

interface BlockWrapperProps {
  node: Node;
  depth: number;
  children: React.ReactNode;
}

export const BlockWrapper: React.FC<BlockWrapperProps> = React.memo(({ node, depth, children }) => {
  const [dragState, setDragState] = useState<"none" | "top" | "bottom">("none");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { setFocusedNode } = useUIStore();
  const focusedNodeId = useUIStore((state) => state.focusedNodeId);
  const isFocused = focusedNodeId === node.id;

  const { blockTypes } = useEditor();

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

  const handleDelete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuOpen(false);
    execute({
      type: "delete_node",
      id: node.id,
      cascade: true,
    });
  };

  const handleDuplicate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setMenuOpen(false);
    const parentNode = useGraphStore.getState().nodes[node.parent || ""];
    if (!parentNode) return;
    const index = parentNode.children.indexOf(node.id);

    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: node.kind,
      parent_id: node.parent,
      index: index + 1,
      props: { ...node.props },
    });
    setFocusedNode(newId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setDragState(isTopHalf ? "top" : "bottom");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState("none");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDragState = dragState;
    setDragState("none");

    const sourceId = e.dataTransfer.getData("application/kye-node");
    if (!sourceId || sourceId === node.id) return;

    const state = useGraphStore.getState();
    const sourceNode = state.nodes[sourceId];
    if (!sourceNode) return;

    const targetParentNode = state.nodes[node.parent || ""];
    if (!targetParentNode) return;

    const childrenWithoutSource = targetParentNode.children.filter((id) => id !== sourceId);
    const targetIndex = childrenWithoutSource.indexOf(node.id);
    if (targetIndex === -1) return;

    let newIndex = targetIndex;
    if (currentDragState === "bottom") {
      newIndex += 1;
    }

    execute({
      type: "move_node",
      node_id: sourceId,
      new_parent_id: node.parent,
      new_index: newIndex,
    });
  };

  const showGutter = depth > 0;

  return (
    <div
      className={`group/block relative w-full transition-all duration-150 rounded-sm flex items-start ${
        isFocused ? "bg-muted/10" : ""
      }`}
      data-node-id={node.id}
      data-kind={node.kind}
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
            className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 rounded transition-colors"
            title="Click to add a block below"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((prev) => !prev);
              }}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/kye-node", node.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              className="p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 rounded cursor-grab active:cursor-grabbing transition-colors"
              title="Drag to move • Click for options"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>

            {/* Notion-Style Block Context Menu */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div
                  ref={menuRef}
                  className="absolute left-full top-0 ml-1.5 z-50 w-48 bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-lg py-1.5 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    onClick={handleDuplicate}
                    className="w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2.5 text-foreground/80 hover:text-foreground"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicate</span>
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full text-left px-3 py-1.5 hover:bg-destructive/10 flex items-center gap-2.5 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>

                  <div className="h-px bg-border/60 my-1" />

                  <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Turn into
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {blockTypes.map((spec) => (
                      <button
                        key={spec.id}
                        className={`w-full text-left px-3 py-1.5 hover:bg-muted/80 flex items-center gap-2.5 transition-colors ${
                          node.kind === spec.kind ? "bg-primary/10 text-primary font-medium" : "text-foreground/80"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuOpen(false);
                          convertBlockType(node, spec);
                        }}
                      >
                        <span className="w-4 h-4 flex items-center justify-center shrink-0 opacity-70">
                          {spec.icon}
                        </span>
                        <span>{spec.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Block Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
});

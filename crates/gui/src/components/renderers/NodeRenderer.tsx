import React, { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { LayoutRenderer } from "./LayoutRenderer";
import { ViewDef, Layout } from "../../types/domain";
import { Plus, GripVertical, Trash2 } from "lucide-react";
import { execute } from "../../lib/commands";
import { useEditor } from "../../context/EditorContext";
import { convertBlockType } from "../../extensions/registry";

interface NodeRendererProps {
  nodeId: string;
  depth?: number;
}

export const NodeRenderer = React.memo(function NodeRenderer({
  nodeId,
  depth = 0,
}: NodeRendererProps) {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const kindDef = useGraphStore((state) =>
    node ? state.kinds[node.kind] : undefined,
  );
  const { setFocusedNode } = useUIStore();
  const { blockTypes } = useEditor();
  const [dragState, setDragState] = useState<"none" | "top" | "bottom">("none");

  if (!node) {
    return (
      <div className="p-2 text-destructive text-sm border border-destructive/20 rounded">
        Node not found: {nodeId}
      </div>
    );
  }

  let activeView: ViewDef | undefined = node.view_override;
  if (!activeView && kindDef?.view) {
    activeView = kindDef.view;
  }

  const activeLayout: Layout = activeView?.layout || {
    t: "Widget",
    v: { name: "fallback" },
  };

  const handleAddBelow = () => {
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

  const handleDelete = () => {
    execute({
      type: "delete_node",
      id: node.id,
      cascade: true,
    });
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

    let childrenWithoutSource = targetParentNode.children.filter(
      (id) => id !== sourceId,
    );
    let targetIndex = childrenWithoutSource.indexOf(node.id);
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

  return (
    <div
      className={`group relative kye-node w-full transition-colors flex ${
        depth > 0 ? "py-0.5" : ""
      }`}
      data-node-id={node.id}
      data-kind={node.kind}
      onDragOver={depth > 0 ? handleDragOver : undefined}
      onDragLeave={depth > 0 ? handleDragLeave : undefined}
      onDrop={depth > 0 ? handleDrop : undefined}
    >
      {dragState === "top" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none" />
      )}
      {dragState === "bottom" && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-50 pointer-events-none" />
      )}

      {}
      {depth > 0 && (
        <div
          className={`absolute -left-12 top-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}
        >
          <button
            onClick={handleAddBelow}
            className="p-1 text-muted-foreground hover:bg-muted rounded hover:text-foreground"
            title="Click to add below"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <div className="relative group/menu">
            <button
              className="p-1 text-muted-foreground hover:bg-muted rounded hover:text-foreground cursor-grab active:cursor-grabbing"
              title="Drag to move. Click to open menu."
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/kye-node", node.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>

            {}
            <div className="absolute left-full top-0 ml-1 hidden group-hover/menu:flex flex-col bg-popover border border-border shadow-md rounded-md py-1 z-50 w-44">
              <button
                className="text-xs text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                onClick={handleDelete}
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
                <span className="text-destructive">Delete</span>
              </button>
              <div className="h-px bg-border my-1" />
              <div className="px-3 py-1 text-[10px] uppercase text-muted-foreground font-semibold">
                Turn into
              </div>
              {blockTypes.map((spec) => (
                <button
                  key={spec.id}
                  className="text-xs text-left px-3 py-1.5 hover:bg-muted flex items-center gap-2"
                  onClick={() => convertBlockType(node, spec)}
                >
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {spec.icon}
                  </span>
                  {spec.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {}
      <div className="flex-1 min-w-0">
        <LayoutRenderer node={node} layout={activeLayout} depth={depth} />
      </div>
    </div>
  );
});

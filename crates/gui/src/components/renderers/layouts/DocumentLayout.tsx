import React from "react";
import { useUIStore } from "../../../store/uiStore";
import { useGraphStore } from "../../../store/graphStore";
import { val } from "../../../types/domain";
import { execute } from "../../../lib/commands";
import { NodeRenderer } from "../NodeRenderer";
import { LayoutProps } from "./types";
import { useCanvasStore } from "../../../store/canvasStore";
import { kyeService } from "../../../services/kyeService";
import { useFileDrop } from "../../../hooks/useFileDrop";

export const DocumentLayout: React.FC<LayoutProps> = ({ node, depth }) => {
  const selectedNodeId = useCanvasStore(state => state.selectedNodeId);
  const isSelected = selectedNodeId === node.id;

  const kindDef = useGraphStore((state) => state.kinds[node.kind]);
  const titleProp = node.props["title"];

  const titleValue =
    titleProp?.t === "Text"
      ? titleProp.v
      : titleProp?.t === "Rich"
        ? titleProp.v.spans.map((s: any) => s.text).join("")
        : "";

  const isLocked = !!val<boolean>(node.props["is_locked"]);
  const isCard = depth > 0;
  const isEditable = depth <= 1 && !isLocked && (!isCard || isSelected);

  const dropRef = useFileDrop<HTMLDivElement>(async (paths) => {
    if (depth !== 0) return; 

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (typeof path === 'string') {
        try {
          const assetNodeId = await kyeService.importAsset(path);
          if (!assetNodeId) continue;

          execute({
            type: "create_node",
            id: crypto.randomUUID(),
            kind: "core.image",
            parent_id: node.id,
            index: node.children.length + i,
            props: {
              url: { t: "Ref", v: assetNodeId },
            },
          });
        } catch (e) {
          console.error("Failed to import media", e);
        }
      }
    }
  });

  return (
    <div 
      ref={dropRef}
      className={`document-layout flex flex-col w-full min-h-full transition-all ${
        depth === 0 ? "max-w-[760px] mx-auto px-12 py-14" : "p-2"
      }`}
    >
      {/* Page Title */}
      <input
        className={`${
          isCard ? "text-xl font-bold mb-3" : "text-4xl font-extrabold tracking-tight mb-6"
        } text-foreground bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/30 transition-colors`}
        value={titleValue}
        readOnly={!isEditable}
        onChange={(e) => {
          execute({
            type: "set_prop",
            node_id: node.id,
            key: "title",
            value: { t: "Text", v: e.target.value },
          });
        }}
        placeholder={kindDef?.label ? `Untitled ${kindDef.label}` : "Untitled"}
      />

      {/* Block Children Stream */}
      <div className="flex flex-col w-full space-y-1">
        {node.children.map((childId) => (
          <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
        ))}
      </div>

      {/* Bottom Clickable Area to Add New Block */}
      {isEditable && (
        <div
          className={`cursor-text mt-4 py-8 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center ${
            node.children.length === 0 ? "min-h-[160px]" : "min-h-[60px]"
          }`}
          onClick={() => {
            const newId = crypto.randomUUID();
            useUIStore.getState().setFocusedNode(newId);
            execute({
              type: "create_node",
              id: newId,
              kind: "core.paragraph",
              parent_id: node.id,
              index: node.children.length,
              props: {
                body: { t: "Rich", v: { spans: [] } },
              },
            });
          }}
        >
          <span className="text-sm font-normal select-none">
            {node.children.length === 0 ? "Click here or press '/' to start writing..." : ""}
          </span>
        </div>
      )}
    </div>
  );
};

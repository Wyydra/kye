import React from "react";
import { useUIStore } from "../../../store/uiStore";
import { useGraphStore } from "../../../store/graphStore";
import { execute } from "../../../lib/commands";
import { NodeRenderer } from "../NodeRenderer";
import { LayoutProps } from "./index";
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

  const isActive = useUIStore(state => state.activePageId === node.id);
  const isLocked = !!node.props["is_locked"]?.v;
  const isCard = depth > 0;
  const isEditable = depth <= 1 && !isLocked && (!isCard || isSelected);

  const dropRef = useFileDrop<HTMLDivElement>(async (paths) => {
    if (depth !== 0) return; // Only process drops at the root document layout
    
    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (typeof path === 'string') {
        try {
          const relativeUrl = await kyeService.importMedia(path);
          
          execute({
            type: "create_node",
            id: crypto.randomUUID(),
            kind: "core.image",
            parent_id: node.id,
            index: node.children.length + i,
            props: {
              url: { t: "Text", v: relativeUrl },
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
        depth === 0 ? "max-w-3xl mx-auto px-8 py-12" : "p-2"
      }`}
    >
      {/* Editable Title */}
      <input
        className={`${isCard ? 'text-xl' : 'text-4xl'} font-bold mb-4 text-foreground/90 bg-transparent border-none outline-none w-full placeholder:opacity-20`}
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
        placeholder={kindDef?.label ? `Untitled ${kindDef.label}` : "Untitled Page"}
      />

      {/* Render Children Recursively */}
      <div className="flex flex-col w-full">
        {node.children.map((childId) => (
          <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
        ))}
      </div>

      {/* Clickable area at the end (Only if editable) */}
      {isEditable && (
        <div
          className={`cursor-text mt-4 text-muted-foreground/20 hover:text-muted-foreground/40 transition-colors ${
            node.children.length === 0 ? "min-h-[100px]" : "min-h-[30px]"
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
          {node.children.length === 0 && "Click to write..."}
        </div>
      )}
    </div>
  );
};

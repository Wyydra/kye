import React from "react";
import { useUIStore } from "../../../store/uiStore";
import { useGraphStore } from "../../../store/graphStore";
import { execute } from "../../../lib/commands";
import { NodeRenderer } from "../NodeRenderer";
import { LayoutProps } from "./index";

export const DocumentLayout: React.FC<LayoutProps> = ({ node, depth }) => {
  const kindDef = useGraphStore((state) => state.kinds[node.kind]);
  const titleProp = node.props["title"];
  
  const titleValue =
    titleProp?.t === "Text"
      ? titleProp.v
      : titleProp?.t === "Rich"
        ? titleProp.v.spans.map((s: any) => s.text).join("")
        : "";

  // If we are deep in the tree, a Document should render as a "Page Link"
  if (depth > 0) {
    return (
      <div
        onClick={() => useUIStore.getState().setActivePage(node.id)}
        className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 rounded-md cursor-pointer text-primary transition-colors"
      >
        <span>{kindDef?.icon || "📄"}</span>
        <span className="font-medium">{titleValue || kindDef?.label || "Untitled"}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col max-w-3xl mx-auto w-full px-8 py-12 min-h-full">
      {/* Editable Title */}
      <input
        className="text-4xl font-bold mb-8 text-foreground/90 bg-transparent border-none outline-none w-full placeholder:opacity-20"
        value={titleValue}
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

      {/* Clickable area at the end */}
      <div
        className={`cursor-text mt-4 text-muted-foreground/20 hover:text-muted-foreground/40 transition-colors ${
          node.children.length === 0 ? "min-h-[200px]" : "min-h-[50px]"
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
        {node.children.length === 0 && "Click to start writing..."}
      </div>
    </div>
  );
};

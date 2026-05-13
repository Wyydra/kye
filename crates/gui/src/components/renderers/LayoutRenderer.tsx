import React from "react";
import { Node, Layout } from "../../types/domain";
import { useUIStore } from "../../store/uiStore";
import { execute } from "../../lib/commands";
import { NodeRenderer } from "./NodeRenderer";
import { ParagraphWidget } from "./widgets/ParagraphWidget";
import { HeadingWidget } from "./widgets/HeadingWidget";
import { TaskWidget } from "./widgets/TaskWidget";

interface LayoutRendererProps {
  node: Node;
  layout: Layout;
  depth: number;
}

export const LayoutRenderer: React.FC<LayoutRendererProps> = ({
  node,
  layout,
  depth,
}) => {
  // ── Document Layout ───────────────────────────────────────────────────────
  if (layout.t === "Document") {
    const titleProp = node.props["title"];
    const titleValue =
      titleProp?.t === "Text"
        ? titleProp.v
        : titleProp?.t === "Rich"
          ? titleProp.v.spans.map((s) => s.text).join("")
          : "Untitled";

    // If we are deep in the tree, a Document should probably render as a "Page Link"
    if (depth > 0) {
      return (
        <div
          onClick={() => useUIStore.getState().setActivePage(node.id)}
          className="flex items-center gap-2 px-3 py-2 hover:bg-muted/50 rounded-md cursor-pointer text-primary transition-colors"
        >
          <span>📄</span>
          <span className="font-medium">{titleValue}</span>
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
          placeholder="Untitled Page"
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
  }

  // ── Stack Layout ──────────────────────────────────────────────────────────
  if (layout.t === "Stack") {
    const isHorizontal = layout.v.direction === "horizontal";
    return (
      <div
        className={`flex ${isHorizontal ? "flex-row items-center gap-4" : "flex-col gap-2"} w-full`}
      >
        {node.children.map((childId) => (
          <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
        ))}
      </div>
    );
  }

  // ── Widget Layout (Atomic components) ─────────────────────────────────────
  if (layout.t === "Widget") {
    switch (layout.v.name) {
      case "paragraph":
        return <ParagraphWidget node={node} />;
      case "heading":
        return <HeadingWidget node={node} />;
      case "task":
        return <TaskWidget node={node} />;
      default:
        return (
          <div className="p-3 border border-dashed border-border rounded text-muted-foreground text-sm flex items-center justify-between">
            <span>Widget: {layout.v.name}</span>
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {node.kind}
            </span>
          </div>
        );
    }
  }

  return (
    <div className="p-4 border border-warning/50 bg-warning/10 rounded-md text-warning text-sm">
      Layout <strong>{layout.t}</strong> not yet implemented.
    </div>
  );
};

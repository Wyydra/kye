import React from "react";
import { useGraphStore } from "../../store/graphStore";
import { LayoutRenderer } from "./LayoutRenderer";
import { ViewDef, Layout } from "../../types/domain";
import { BlockWrapper } from "./layouts/BlockWrapper";

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

  return (
    <BlockWrapper node={node} depth={depth}>
      <LayoutRenderer node={node} layout={activeLayout} depth={depth} />
    </BlockWrapper>
  );
});

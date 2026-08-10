import React from "react";
import { useGraphStore } from "../../store/graphStore";
import { SurfaceRenderer } from "./surfaces/SurfaceRenderer";
import { ViewDef } from "../../types/domain";
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

  const defaultView: ViewDef = {
    surface: { t: "Document", v: { layout: { t: "VerticalStream" } } },
    source: { t: "DirectChildren" },
    overlay: { hidden_edge_kinds: [] },
    bindings: {},
    actions: [],
  };

  return (
    <BlockWrapper node={node} depth={depth}>
      <SurfaceRenderer node={node} viewDef={activeView || defaultView} depth={depth} />
    </BlockWrapper>
  );
});


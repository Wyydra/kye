import React from "react";
import { Node, Layout } from "../../types/domain";
import { getLayout } from "./layouts/registry";

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
  const LayoutComponent = getLayout(layout.t);

  if (LayoutComponent) {
    return <LayoutComponent node={node} layout={layout} depth={depth} />;
  }

  return (
    <div className="p-4 border border-warning/50 bg-warning/10 rounded-md text-warning text-sm">
      Layout <strong>{layout.t}</strong> not found in registry.
    </div>
  );
};

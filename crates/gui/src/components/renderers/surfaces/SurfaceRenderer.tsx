import React from "react";
import { Node, Surface, ViewDef } from "../../../types/domain";
import {
  getSurface,
  registerSurface,
} from "./registry";
import { DocumentSurface } from "./DocumentSurface";
import { CollectionSurface } from "./CollectionSurface";
import { CanvasLayout } from "../layouts/CanvasLayout";
import { WidgetLayout } from "../layouts/WidgetLayout";

// Register default Surfaces in strategy registry
registerSurface("Document", ({ node, surface, depth }) => (
  <DocumentSurface
    node={node}
    layout={surface.t === "Document" ? surface.v.layout : { t: "VerticalStream" }}
    depth={depth}
  />
));

registerSurface("Canvas", ({ node, depth }) => (
  <CanvasLayout node={node} depth={depth} />
));

registerSurface("Collection", ({ node, surface, depth }) => (
  <CollectionSurface
    node={node}
    layout={surface.t === "Collection" ? surface.v.layout : { t: "List" }}
    depth={depth}
  />
));

registerSurface("Widget", ({ node, surface, depth }) => (
  <WidgetLayout
    node={node}
    widgetName={surface.t === "Widget" ? surface.v.name : "fallback"}
    depth={depth}
  />
));

interface SurfaceRendererProps {
  node: Node;
  viewDef: ViewDef;
  depth: number;
}

export const SurfaceRenderer: React.FC<SurfaceRendererProps> = ({
  node,
  viewDef,
  depth,
}) => {
  const surface: Surface = viewDef.surface || {
    t: "Document",
    v: { layout: { t: "VerticalStream" } },
  };

  const Component = getSurface(surface.t);

  if (Component) {
    return <Component node={node} surface={surface} depth={depth} />;
  }

  return (
    <div className="p-4 border border-warning/50 bg-warning/10 rounded text-warning text-sm">
      Unknown surface type: {surface.t}
    </div>
  );
};


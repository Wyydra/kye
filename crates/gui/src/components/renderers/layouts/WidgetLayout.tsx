import React from "react";
import { NodeRenderer } from "../NodeRenderer";
import { LayoutProps } from "./types";
import * as widgetRegistry from "../widgets";

export const WidgetLayout: React.FC<LayoutProps> = ({ node, layout, depth }) => {
  if (layout.t !== "Widget") return null;

  const Widget = widgetRegistry.getWidget(layout.v.name);
  let widgetContent;

  if (Widget) {
    widgetContent = <Widget node={node} />;
  } else {
    widgetContent = (
      <div className="p-3 border border-dashed border-border rounded text-muted-foreground text-sm flex items-center justify-between">
        <span>Widget: {layout.v.name}</span>
        <span className="text-xs bg-muted px-2 py-1 rounded">
          {node.kind}
        </span>
      </div>
    );
  }

  if (node.children.length === 0) {
    return widgetContent;
  }

  return (
    <div className="flex flex-col w-full">
      {widgetContent}
      <div className="ml-6 mt-0.5 border-l border-border/30 pl-4">
        {node.children.map((childId) => (
          <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
};

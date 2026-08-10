import React from "react";
import { Node } from "../../../types/domain";
import { NodeRenderer } from "../NodeRenderer";
import * as widgetRegistry from "../widgets";

interface WidgetLayoutProps {
  node: Node;
  widgetName: string;
  depth?: number;
}

export const WidgetLayout: React.FC<WidgetLayoutProps> = ({ node, widgetName, depth = 0 }) => {
  const Widget = widgetRegistry.getWidget(widgetName);
  let widgetContent;

  if (Widget) {
    widgetContent = <Widget node={node} />;
  } else {
    widgetContent = (
      <div className="p-3 border border-dashed border-border rounded text-muted-foreground text-sm flex items-center justify-between">
        <span>Widget: {widgetName}</span>
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


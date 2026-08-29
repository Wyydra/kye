import React from "react";
import { Node, val } from "../../../types/domain";
import { NodeRenderer } from "../NodeRenderer";
import * as widgetRegistry from "../widgets";

interface WidgetLayoutProps {
  node: Node;
  widgetName: string;
  depth?: number;
}

export const WidgetLayout: React.FC<WidgetLayoutProps> = ({ node, widgetName, depth = 0 }) => {
  const Widget = widgetRegistry.getWidget(widgetName);
  const isCollapsed = !!val<boolean>(node.props.is_collapsed);

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

  // If node has no children or is collapsed, only render the block itself
  if (node.children.length === 0 || isCollapsed) {
    return widgetContent;
  }

  return (
    <div className="flex flex-col w-full">
      {widgetContent}
      <div className="ml-5 mt-1 border-l-2 border-border/30 hover:border-primary/40 pl-3.5 space-y-1 transition-colors">
        {node.children.map((childId) => (
          <NodeRenderer key={childId} nodeId={childId} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
};

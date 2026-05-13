import React from "react";
import { NodeRenderer } from "../NodeRenderer";
import { LayoutProps } from "./index";

export const StackLayout: React.FC<LayoutProps> = ({ node, layout, depth }) => {
  if (layout.t !== "Stack") return null;

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
};

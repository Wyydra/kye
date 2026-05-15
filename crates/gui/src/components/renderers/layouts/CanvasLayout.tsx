import React from "react";
import { LayoutProps } from "./types";
import { BaseCanvas } from "./BaseCanvas";
import { execute } from "../../../lib/commands";

export const CanvasLayout: React.FC<LayoutProps> = ({ node, depth }) => {
  const handleDoubleClick = (x: number, y: number, kind: string) => {
    execute({
      type: "create_node",
      id: crypto.randomUUID(),
      kind,
      parent_id: node.id,
      index: node.children.length,
      props: {
        x: { t: "Float", v: x },
        y: { t: "Float", v: y },
      },
    });
  };

  return (
    <BaseCanvas 
      childrenIds={node.children} 
      depth={depth} 
      onDoubleClick={handleDoubleClick}
    />
  );
};

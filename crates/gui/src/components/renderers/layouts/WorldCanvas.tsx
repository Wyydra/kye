import React from "react";
import { useGraphStore } from "../../../store/graphStore";
import { BaseCanvas } from "./BaseCanvas";
import { execute } from "../../../lib/commands";

export const WorldCanvas: React.FC = () => {
  const roots = useGraphStore(state => state.roots);

  const handleDoubleClick = (x: number, y: number, kind: string) => {
    execute({
      type: "create_node",
      id: crypto.randomUUID(),
      kind,
      parent_id: null,
      index: roots.length,
      props: {
        title: { t: "Text", v: "New Node" },
        x: { t: "Float", v: x },
        y: { t: "Float", v: y },
      },
    });
  };

  return (
    <div className="w-full h-full">
      <BaseCanvas 
        childrenIds={roots} 
        depth={0} 
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

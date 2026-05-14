import React from "react";
import { useGraphStore } from "../../../store/graphStore";
import { BaseCanvas } from "./BaseCanvas";
import { execute } from "../../../lib/commands";
import { kyeService } from "../../../services/kyeService";
import { useCanvasStore } from "../../../store/canvasStore";
import { useFileDrop } from "../../../hooks/useFileDrop";

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
        x: { t: "Float", v: x },
        y: { t: "Float", v: y },
      },
    });
  };

  const dropRef = useFileDrop<HTMLDivElement>(async (paths, position) => {
    if (!Array.isArray(paths) || paths.length === 0) return;

    // Convert to world coordinates
    const { viewport } = useCanvasStore.getState();
    const x = (position.x - viewport.x) / viewport.zoom;
    const y = (position.y - viewport.y) / viewport.zoom;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (typeof path === 'string') {
        try {
          const relativeUrl = await kyeService.importMedia(path);
          
          execute({
            type: "create_node",
            id: crypto.randomUUID(),
            kind: "core.image",
            parent_id: null,
            index: roots.length + i,
            props: {
              url: { t: "Text", v: relativeUrl },
              x: { t: "Float", v: x + (i * 20) },
              y: { t: "Float", v: y + (i * 20) },
            },
          });
        } catch (e) {
          console.error("Failed to import media", e);
        }
      }
    }
  });

  return (
    <div ref={dropRef} className="w-full h-full">
      <BaseCanvas 
        childrenIds={roots} 
        depth={0} 
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

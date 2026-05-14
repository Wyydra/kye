import React from "react";
import { useGraphStore } from "../../../store/graphStore";
import { BaseCanvas } from "./BaseCanvas";
import { execute } from "../../../lib/commands";
import { listen } from "@tauri-apps/api/event";
import { kyeService } from "../../../services/kyeService";
import { useCanvasStore } from "../../../store/canvasStore";

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

  React.useEffect(() => {
    const unlistens: (() => void)[] = [];

    const handleDrop = async (event: any) => {
      // payload paths are typically array of strings
      const paths = event.payload?.paths || event.payload;
      if (!Array.isArray(paths) || paths.length === 0) return;

      // Extract roughly where they dropped it
      const screenX = event.payload?.position?.x || window.innerWidth / 2;
      const screenY = event.payload?.position?.y || window.innerHeight / 2;

      // Convert to world coordinates
      const { viewport } = useCanvasStore.getState();
      const x = (screenX - viewport.x) / viewport.zoom;
      const y = (screenY - viewport.y) / viewport.zoom;

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
    };

    listen("tauri://drag-drop", handleDrop).then(fn => unlistens.push(fn));

    return () => {
      unlistens.forEach(fn => fn());
    };
  }, [roots.length]);

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

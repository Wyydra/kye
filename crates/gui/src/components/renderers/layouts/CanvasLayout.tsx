import React from "react";
import { LayoutProps } from "./types";
import { CanvasContainer } from "../../canvas/CanvasContainer";
import { execute } from "../../../lib/commands";
import { useGraphStore } from "../../../store/graphStore";
import { kyeService } from "../../../services/kyeService";
import { useCanvasStore } from "../../../store/canvasStore";
import { useFileDrop } from "../../../hooks/useFileDrop";

export const CanvasLayout: React.FC<Partial<LayoutProps>> = ({ node, depth = 0 }) => {
  const roots = useGraphStore((state) => state.roots);

  const parentId = node ? node.id : null;
  const childrenIds = node ? node.children : roots;

  const handleDoubleClick = (x: number, y: number, kind: string) => {
    execute({
      type: "create_node",
      id: crypto.randomUUID(),
      kind,
      parent_id: parentId,
      index: childrenIds.length,
      props: {
        x: { t: "Float", v: x },
        y: { t: "Float", v: y },
      },
    });
  };

  const dropRef = useFileDrop<HTMLDivElement>(async (paths, position) => {
    if (!Array.isArray(paths) || paths.length === 0) return;

    const { viewport } = useCanvasStore.getState();
    const x = (position.x - viewport.x) / viewport.zoom;
    const y = (position.y - viewport.y) / viewport.zoom;

    for (let i = 0; i < paths.length; i++) {
      const path = paths[i];
      if (typeof path === "string") {
        try {
          const assetNodeId = await kyeService.importAsset(path);
          if (!assetNodeId) continue;

          execute({
            type: "create_node",
            id: crypto.randomUUID(),
            kind: "core.image",
            parent_id: parentId,
            index: childrenIds.length + i,
            props: {
              url: { t: "Ref", v: assetNodeId },
              x: { t: "Float", v: x + i * 20 },
              y: { t: "Float", v: y + i * 20 },
              width: { t: "Float", v: 300 },
              height: { t: "Float", v: 200 },
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
      <CanvasContainer
        childrenIds={childrenIds}
        depth={depth}
        onDoubleClick={handleDoubleClick}
      />
    </div>
  );
};

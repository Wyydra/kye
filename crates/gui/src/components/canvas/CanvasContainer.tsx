import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useCanvasCamera } from "../../hooks/useCanvasCamera";
import { EdgeLayer } from "./EdgeLayer";
import { NodeLayer } from "./NodeLayer";
import { useGraphStore } from "../../store/graphStore";
import { execute } from "../../lib/commands";
import { useCanvasStore } from "../../store/canvasStore";
import { CanvasCreationMenu } from "../renderers/layouts/CanvasCreationMenu";
import { GridBackground } from "../renderers/layouts/GridBackground";
import { getVisibleWorldRect, Rect } from "../../lib/viewport";

interface CanvasContainerProps {
  childrenIds: string[];
  depth: number;
  onDoubleClick?: (x: number, y: number, kind: string) => void;
}

export const CanvasContainer: React.FC<CanvasContainerProps> = ({
  childrenIds,
  depth,
  onDoubleClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const nodes = useGraphStore((state) => state.nodes);
  const [menu, setMenu] = useState<{ x: number; y: number; worldX: number; worldY: number } | null>(null);
  const [visibleRect, setVisibleRect] = useState<Rect | null>(null);

  const connectionDraft = useCanvasStore((state) => state.connectionDraft);
  const setConnectionDraft = useCanvasStore((state) => state.setConnectionDraft);
  const updateConnectionDraft = useCanvasStore((state) => state.updateConnectionDraft);
  const viewport = useCanvasStore((state) => state.viewport);

  useCanvasCamera(containerRef, layerRef);

  // Recalculate visible world rectangle on viewport changes
  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setVisibleRect(getVisibleWorldRect(viewport, rect.width, rect.height));
  }, [viewport]);

  const { contentNodes, connectionNodes } = useMemo(() => {
    const content: string[] = [];
    const connections: string[] = [];

    childrenIds.forEach((childId) => {
      const child = nodes[childId];
      if (child?.kind === "core.connection") {
        connections.push(childId);
      } else {
        content.push(childId);
      }
    });

    return { contentNodes: content, connectionNodes: connections };
  }, [childrenIds, nodes]);

  useEffect(() => {
    if (!connectionDraft) return;

    const onPointerMove = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const { x, y, zoom } = useCanvasStore.getState().viewport;

      const worldX = (e.clientX - rect.left - x) / zoom;
      const worldY = (e.clientY - rect.top - y) / zoom;

      const element = document.elementFromPoint(e.clientX, e.clientY);
      const nodeEl = element?.closest("[data-node-id]");
      const targetId = nodeEl?.getAttribute("data-node-id") || null;

      updateConnectionDraft(worldX, worldY, targetId);
    };

    const onPointerUp = () => {
      const draft = useCanvasStore.getState().connectionDraft;
      if (draft?.sourceId && draft.targetId && draft.sourceId !== draft.targetId) {
        execute({
          type: "create_node",
          id: crypto.randomUUID(),
          kind: "core.connection",
          parent_id: null,
          index: 0,
          props: {
            from: { t: "Ref", v: draft.sourceId },
            to: { t: "Ref", v: draft.targetId },
          },
        });
      }
      setConnectionDraft(null);
    };

    if (connectionDraft) {
      document.body.classList.add("is-dragging");
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [!!connectionDraft, setConnectionDraft, updateConnectionDraft]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-node-id], .interactive-handle")) return;

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const { x, y, zoom } = useCanvasStore.getState().viewport;

      const worldX = (mouseX - x) / zoom;
      const worldY = (mouseY - y) / zoom;

      setMenu({ x: e.clientX, y: e.clientY, worldX, worldY });
    },
    []
  );

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-background overflow-hidden cursor-default touch-none select-none"
      onDoubleClick={handleDoubleClick}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) {
          setMenu(null);
          useCanvasStore.getState().setSelectedNodeId(null);
        }
      }}
    >
      <GridBackground x={viewport.x} y={viewport.y} zoom={viewport.zoom} />

      <div
        ref={layerRef}
        className="absolute inset-0 pointer-events-none"
        style={{ transformOrigin: "0 0" }}
      >
        <EdgeLayer connectionIds={connectionNodes} connectionDraft={connectionDraft} />
        <NodeLayer
          contentIds={contentNodes}
          connectionIds={connectionNodes}
          depth={depth}
          visibleWorldRect={visibleRect}
        />
      </div>

      {menu && (
        <CanvasCreationMenu
          x={menu.x}
          y={menu.y}
          onSelect={(kind) => {
            onDoubleClick?.(menu.worldX, menu.worldY, kind);
            setMenu(null);
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
};

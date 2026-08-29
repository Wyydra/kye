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
import { Plus, Minus } from "lucide-react";
import { Button } from "../ui/Button";

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
  const setViewport = useCanvasStore((state) => state.setViewport);

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

  const openCreationMenuAt = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;

      const { x, y, zoom } = useCanvasStore.getState().viewport;
      const worldX = (mouseX - x) / zoom;
      const worldY = (mouseY - y) / zoom;

      setMenu({ x: clientX, y: clientY, worldX, worldY });
    },
    []
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-node-id], .interactive-handle")) return;
      openCreationMenuAt(e.clientX, e.clientY);
    },
    [openCreationMenuAt]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-node-id], .interactive-handle")) return;
      e.preventDefault();
      openCreationMenuAt(e.clientX, e.clientY);
    },
    [openCreationMenuAt]
  );

  const handleZoom = (delta: number) => {
    const nextZoom = Math.max(0.1, Math.min(3, viewport.zoom + delta));
    setViewport({ ...viewport, zoom: nextZoom });
  };

  const handleResetZoom = () => {
    setViewport({ ...viewport, zoom: 1 });
  };

  const handleAddAtCenter = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    openCreationMenuAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-background overflow-hidden cursor-default touch-none select-none font-sans"
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
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

      {/* Floating Canvas Click Controls */}
      <div className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5 bg-card/90 backdrop-blur-sm border border-border/70 rounded-lg p-1 shadow-md">
        <Button
          variant="ghost"
          size="xs"
          leftIcon={<Plus className="w-3.5 h-3.5" />}
          onClick={handleAddAtCenter}
          title="Add block to canvas"
        >
          Add Node
        </Button>

        <div className="w-[1px] h-4 bg-border/60" />

        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Zoom out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-1.5 py-0.5 hover:bg-muted rounded text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Reset zoom to 100%"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>

        <button
          onClick={() => handleZoom(0.15)}
          className="p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Zoom in"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
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

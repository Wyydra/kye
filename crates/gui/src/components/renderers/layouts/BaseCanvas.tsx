import React, { useRef, useMemo, useCallback, useState, useEffect } from "react";
import { useCanvasCamera } from "../../../hooks/useCanvasCamera";
import { CanvasNode } from "./CanvasNode";
import { CanvasConnection } from "./CanvasConnection";
import { ConnectionOverlay } from "./ConnectionOverlay";
import { useGraphStore } from "../../../store/graphStore";
import { execute } from "../../../lib/commands";
import { useCanvasStore } from "../../../store/canvasStore";
import { CanvasCreationMenu } from "./CanvasCreationMenu";
import { GridBackground } from "./GridBackground";
import { getBezierPath } from "../../../lib/geometry";

interface BaseCanvasProps {
  childrenIds: string[];
  depth: number;
  onDoubleClick?: (x: number, y: number, kind: string) => void;
}

export const BaseCanvas: React.FC<BaseCanvasProps> = ({ childrenIds, depth, onDoubleClick }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const nodes = useGraphStore(state => state.nodes);
  const [menu, setMenu] = useState<{ x: number, y: number, worldX: number, worldY: number } | null>(null);

  const connectionDraft = useCanvasStore(state => state.connectionDraft);
  const setConnectionDraft = useCanvasStore(state => state.setConnectionDraft);
  const updateConnectionDraft = useCanvasStore(state => state.updateConnectionDraft);
  const viewport = useCanvasStore(state => state.viewport);

  // Initialize camera logic
  useCanvasCamera(containerRef, layerRef);

  // Separate children into content nodes and connection nodes
  const { contentNodes, connectionNodes } = useMemo(() => {
    const content: string[] = [];
    const connections: string[] = [];
    
    childrenIds.forEach(childId => {
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

      // Find if we are over a node
      const element = document.elementFromPoint(e.clientX, e.clientY);
      const nodeEl = element?.closest("[data-node-id]");
      const targetId = nodeEl?.getAttribute("data-node-id");

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

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [connectionDraft, setConnectionDraft, updateConnectionDraft]);

  const draftPath = useMemo(() => {
    if (!connectionDraft) return null;
    const sourceNode = nodes[connectionDraft.sourceId];
    if (!sourceNode) return null;

    const x1 = (sourceNode.props["x"]?.v as number) || 0;
    const y1 = (sourceNode.props["y"]?.v as number) || 0;
    const width = (sourceNode.props["width"]?.v as number) || 300;
    const height = (sourceNode.props["height"]?.v as number) || 200;
    
    const startX = x1 + width / 2;
    const startY = y1 + height / 2;

    return getBezierPath(
      { x: startX, y: startY },
      { x: connectionDraft.currentX, y: connectionDraft.currentY }
    );
  }, [connectionDraft, nodes]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Only open if we didn't click on a node or handle
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
  }, []);

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
      {/* SVG Grid Background */}
      <GridBackground x={viewport.x} y={viewport.y} zoom={viewport.zoom} />

      {/* Main Transformation Layer */}
      <div
        ref={layerRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          transformOrigin: "0 0",
        }}
      >
        {/* Connection Layer (SVG) */}
        <svg className="absolute inset-0 w-[100000px] h-[100000px] -translate-x-[50000px] -translate-y-[50000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" fillOpacity="0.4" />
            </marker>
          </defs>
          <g transform="translate(50000, 50000)">
             {connectionNodes.map(id => (
               <CanvasConnection key={id} connectionId={id} />
             ))}
             {draftPath && (
               <path
                 d={draftPath}
                 fill="none"
                 stroke="hsl(var(--primary))"
                 strokeWidth="2"
                 strokeDasharray="4 4"
                 strokeOpacity="0.6"
                 markerEnd="url(#arrowhead)"
               />
             )}
          </g>
        </svg>

        {/* Node Layer (HTML) */}
        <div className="absolute inset-0">
          {contentNodes.map(id => (
            <CanvasNode key={id} nodeId={id} depth={depth + 1} />
          ))}
          {connectionNodes.map(id => (
            <ConnectionOverlay key={id} connectionId={id} />
          ))}
        </div>
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

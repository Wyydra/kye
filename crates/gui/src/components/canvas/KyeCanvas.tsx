import React, { memo, useMemo, useRef, useState, useCallback, useEffect } from 'react';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { useCamera } from '../../hooks/useCamera';
import { GridBackground } from './GridBackground';
import { Workspace, TemplateDto, Block } from '../../types/workspace';
import { KyeBlock } from '../blocks/KyeBlock';
import { CanvasMenu } from './CanvasMenu';
import { DraftLink } from './DraftLink';
import { eventBus } from '../../lib/eventBus';
import { workspaceService } from '../../services/WorkspaceService';
import '../blocks/renderers';

interface KyeCanvasProps {
  workspace: Workspace | null;
  templates: TemplateDto[];
  onRefresh: () => void;
}

export const KyeCanvas = memo(function KyeCanvas({ workspace, templates, onRefresh }: KyeCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  
  // High-performance camera logic (pan/zoom)
  const { viewport } = useCamera(containerRef, layerRef);
  
  // Atomic selectors for actions only (stable)
  const setSelectedNodeId = useCanvasStore(state => state.setSelectedNodeId);
  const setConnectionDraft = useCanvasStore(state => state.setConnectionDraft);
  const updateConnectionMouse = useCanvasStore(state => state.updateConnectionMouse);
  const setHoveredNodeId = useCanvasStore(state => state.setHoveredNodeId);
  const setAllNodeStates = useCanvasStore(state => state.setAllNodeStates);
  
  // Selection and connection states (selective subscription)
  const isConnecting = useCanvasStore(state => !!state.connectionDraft);

  // Menu state
  const [menu, setMenu] = useState<{ x: number, y: number, worldX: number, worldY: number } | null>(null);

  // Menu logic
  const openMenuAt = useCallback((screenX: number, screenY: number) => {
    const worldX = (screenX - viewport.x) / viewport.zoom;
    const worldY = (screenY - viewport.y) / viewport.zoom;
    setMenu({ x: screenX, y: screenY, worldX, worldY });
  }, [viewport]);

  useEffect(() => {
    const unsub = eventBus.on('canvas:menu:open', () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      openMenuAt(rect.width / 2, rect.height / 2);
    });
    return unsub;
  }, [openMenuAt]);
  
  // Initialize all node states from workspace metadata (even off-screen nodes)
  useEffect(() => {
    if (!workspace) return;
    
    const states: Record<string, any> = {};
    workspace.blocks.forEach(block => {
      try {
        const meta = JSON.parse(block.metadata);
        // Use prefixed fields (_x, _y, _width, _height)
        if (meta._x !== undefined && meta._y !== undefined) {
          states[block.id] = {
            x: meta._x,
            y: meta._y,
            width: meta._width ?? 300,
            height: meta._height ?? 200
          };
        }
      } catch {}
    });
    
    setAllNodeStates(states);
  }, [workspace, setAllNodeStates]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (e.target !== containerRef.current) return;
    const rect = containerRef.current!.getBoundingClientRect();
    openMenuAt(e.clientX - rect.left, e.clientY - rect.top);
  }, [openMenuAt]);

  // No more manual split! The canvas is universal.

  // Global listeners for connection drafting
  useEffect(() => {
    if (!isConnecting) return;

    const onMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
      const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;
      updateConnectionMouse(x, y);

      // Target highlighting
      const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
      const nodeEl = element?.closest('[data-node-id]');
      const targetId = nodeEl?.getAttribute('data-node-id');
      setHoveredNodeId(targetId || null);
    };

    const onUp = async (e: PointerEvent) => {
      try {
        const element = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement;
        const nodeEl = element?.closest('[data-node-id]');
        const targetId = nodeEl?.getAttribute('data-node-id');
        const currentSourceId = useCanvasStore.getState().connectionDraft?.sourceId;

        if (targetId && currentSourceId && targetId !== currentSourceId) {
          await workspaceService.createBlock(
            "", 
            JSON.stringify({ from: currentSourceId, to: targetId })
          );
          onRefresh();
        }
      } catch (err) {
        console.error("Failed to create connection:", err);
      } finally {
        setConnectionDraft(null);
        setHoveredNodeId(null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isConnecting, viewport.x, viewport.y, viewport.zoom, updateConnectionMouse, setConnectionDraft, setHoveredNodeId, onRefresh]);

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative', 
        background: 'var(--background)', 
        overflow: 'hidden',
        cursor: 'default',
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        if (e.target === containerRef.current) {
          setSelectedNodeId(null);
          setMenu(null);
        }
      }}
      onDoubleClick={handleDoubleClick}
    >
      <GridBackground x={viewport.x} y={viewport.y} zoom={viewport.zoom} />
      
      <div 
        ref={layerRef} 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: 0, 
          height: 0, 
          willChange: 'transform',
        }}
      >
        <svg 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100000px',
            height: '100000px',
            transform: 'translate(-50000px, -50000px)',
            pointerEvents: 'none',
            overflow: 'visible',
            zIndex: 0,
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" fillOpacity="0.8" />
            </marker>
          </defs>
          <g transform="translate(50000, 50000)">
            {workspace?.blocks.map((block) => (
              <KyeBlock 
                key={`${block.id}-svg`} 
                block={block} 
                templates={templates}
                layer="svg"
                onRefresh={onRefresh}
              />
            ))}
            <DraftLink />
          </g>
        </svg>

        {workspace?.blocks.map((block) => (
          <KyeBlock 
            key={`${block.id}-html`} 
            block={block} 
            templates={templates}
            layer="html"
            zoom={viewport.zoom}
            onRefresh={onRefresh}
          />
        ))}
      </div>

      {menu && (
        <CanvasMenu 
          x={menu.x} 
          y={menu.y} 
          worldX={menu.worldX} 
          worldY={menu.worldY} 
          templates={templates}
          onClose={() => setMenu(null)}
          onCreated={onRefresh}
        />
      )}
    </div>
  );
});

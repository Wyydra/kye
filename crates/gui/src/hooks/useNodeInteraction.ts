import { useState, useCallback, useEffect, useRef } from 'react';
import { Block } from '../types/workspace';
import { useCanvasStore } from './useCanvasStore';
import { useDraggable } from './useDraggable';
import { useResizable } from './useResizable';
import { workspaceService } from '../services/WorkspaceService';

export function useNodeInteraction(block: Block, zoom: number = 1) {
  const initialMeta = useRef(block.metadata);
  const [meta, setMeta] = useState(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  });

  // Local state for fluid interaction
  const [pos, setPos] = useState({ x: meta.x ?? 0, y: meta.y ?? 0 });
  const [size, setSize] = useState({ width: meta.width ?? 300, height: meta.height ?? 200 });

  const { updateNodeState, removeNodeState, setSelectedNodeId } = useCanvasStore();

  // Sync to store for edges
  useEffect(() => {
    updateNodeState(block.id, { ...pos, ...size });
  }, [block.id, pos, size, updateNodeState]);

  useEffect(() => {
    return () => removeNodeState(block.id);
  }, [block.id, removeNodeState]);

  // Sync with block props (if changed by others)
  useEffect(() => {
    if (block.metadata !== initialMeta.current) {
      initialMeta.current = block.metadata;
      try {
        const newMeta = JSON.parse(block.metadata);
        setMeta(newMeta);
        setPos({ x: newMeta.x ?? pos.x, y: newMeta.y ?? pos.y });
        setSize({ width: newMeta.width ?? size.width, height: newMeta.height ?? size.height });
      } catch {}
    }
  }, [block.metadata]);

  const save = useCallback(async (updates?: { pos?: typeof pos, size?: typeof size, meta?: any, content?: string }) => {
    const finalPos = updates?.pos ?? pos;
    const finalSize = updates?.size ?? size;
    const finalMeta = { ...meta, ...(updates?.meta ?? {}), ...finalPos, ...finalSize };
    const finalContent = updates?.content ?? block.content;
    
    // Round for clean storage
    finalMeta.x = Math.round(finalMeta.x);
    finalMeta.y = Math.round(finalMeta.y);
    finalMeta.width = Math.round(finalMeta.width);
    finalMeta.height = Math.round(finalMeta.height);

    const metaStr = JSON.stringify(finalMeta);
    const contentChanged = finalContent !== block.content;
    const metaChanged = metaStr !== block.metadata;

    if (contentChanged || metaChanged) {
      await workspaceService.updateBlock(block.id, contentChanged ? finalContent : null, metaChanged ? metaStr : null);
    }
  }, [block.id, block.metadata, pos, size, meta]);

  const onSelect = useCallback(() => setSelectedNodeId(block.id), [block.id, setSelectedNodeId]);

  const { startDragging } = useDraggable(zoom, pos, setPos, onSelect, (p) => save({ pos: p }));
  const { startResizing } = useResizable(zoom, size, setSize, pos, setPos, (p, s) => save({ pos: p, size: s }));

  return {
    pos,
    size,
    meta,
    startDragging,
    startResizing,
    onSelect,
    save
  };
}

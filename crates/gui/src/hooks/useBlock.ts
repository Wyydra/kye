import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Block } from '../types/workspace';
import { useCanvasStore } from './useCanvasStore';
import { workspaceService } from '../services/WorkspaceService';

export function useBlock(block: Block, onRefresh?: () => void) {
  const isSelected = useCanvasStore(state => state.selectedNodeId === block.id);
  const isEditing = useCanvasStore(state => state.editingBlockId === block.id);
  const setSelectedNodeId = useCanvasStore(state => state.setSelectedNodeId);
  const setEditingBlockId = useCanvasStore(state => state.setEditingBlockId);
  const updateNodeState = useCanvasStore(state => state.updateNodeState);
  
  const setIsEditing = useCallback((val: boolean) => {
    setEditingBlockId(val ? block.id : null);
  }, [block.id, setEditingBlockId]);
  
  // Parse metadata
  const meta = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  // Sync position to global store (for edges)
  useEffect(() => {
    if (meta._x !== undefined && meta._y !== undefined) {
      updateNodeState(block.id, {
        x: meta._x,
        y: meta._y,
        width: meta._width ?? 300,
        height: meta._height ?? 200
      });
    }
  }, [block.id, meta._x, meta._y, meta._width, meta._height, updateNodeState]);

  const save = useCallback(async (content?: string, metadataUpdate?: Record<string, any>) => {
    const newContent = content ?? block.content;
    const newMeta = metadataUpdate ? JSON.stringify({ ...meta, ...metadataUpdate }) : block.metadata;
    
    if (newContent !== block.content || newMeta !== block.metadata) {
      await workspaceService.updateBlock(block.id, newContent, newMeta);
      onRefresh?.();
    }
  }, [block.id, block.content, block.metadata, meta, onRefresh]);

  const select = useCallback(() => setSelectedNodeId(block.id), [block.id, setSelectedNodeId]);
  const toggleEdit = useCallback(() => setIsEditing(!isEditing), [isEditing]);

  return {
    isSelected,
    isEditing,
    setIsEditing,
    meta,
    select,
    toggleEdit,
    save
  };
}

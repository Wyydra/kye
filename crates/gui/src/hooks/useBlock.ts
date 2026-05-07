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
  
  // Access fields directly
  const fields = block.fields;

  // Sync position to global store (for edges)
  useEffect(() => {
    if (fields._x !== undefined && fields._y !== undefined) {
      updateNodeState(block.id, {
        x: fields._x,
        y: fields._y,
        width: fields._width ?? 300,
        height: fields._height ?? 200
      });
    }
  }, [block.id, fields._x, fields._y, fields._width, fields._height, updateNodeState]);

  const save = useCallback(async (fieldsUpdate?: Record<string, any>) => {
    const newFields = fieldsUpdate ? { ...fields, ...fieldsUpdate } : fields;
    
    if (JSON.stringify(newFields) !== JSON.stringify(fields)) {
      await workspaceService.updateBlock(block.id, newFields);
      onRefresh?.();
    }
  }, [block.id, fields, onRefresh]);

  const select = useCallback(() => setSelectedNodeId(block.id), [block.id, setSelectedNodeId]);
  const toggleEdit = useCallback(() => setIsEditing(!isEditing), [isEditing]);

  return {
    isSelected,
    isEditing,
    setIsEditing,
    fields,
    select,
    toggleEdit,
    save
  };
}

import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Block } from '../../types/workspace';
import { useBlock } from '../../hooks/useBlock';
import { blockRegistry } from './renderers/BlockRegistry';
import { KyeBlockEditor } from './KyeBlockEditor';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { useWorkspace } from '../../context/WorkspaceContext';
import { UniversalRenderer } from './renderers/UniversalRenderer';
import { SelectionFrame } from './renderers/SelectionFrame';
import { cn } from '../../lib/utils';
import { useResizable } from '../../hooks/useResizable';
import { useDraggable } from '../../hooks/useDraggable';

interface KyeBlockProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  onRefresh: () => void;
}

export const KyeBlock = memo(function KyeBlock({ block, layer, zoom = 1, onRefresh }: KyeBlockProps) {
  const blockLogic = useBlock(block);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  const setConnectionDraft = useCanvasStore(state => state.setConnectionDraft);
  const { templates } = useWorkspace();

  // Resizable logic
  const { startResizing } = useResizable(
    zoom,
    { width: nodeStates[block.id]?.width || 300, height: nodeStates[block.id]?.height || 200 },
    (size) => useCanvasStore.getState().updateNodeState(block.id, size),
    { x: nodeStates[block.id]?.x || 0, y: nodeStates[block.id]?.y || 0 },
    (pos) => useCanvasStore.getState().updateNodeState(block.id, pos),
    (finalPos, finalSize) => blockLogic.save(undefined, { ...finalPos, ...finalSize })
  );

  const { startDragging } = useDraggable(
    zoom,
    { x: nodeStates[block.id]?.x || 0, y: nodeStates[block.id]?.y || 0 },
    (pos) => useCanvasStore.getState().updateNodeState(block.id, pos),
    blockLogic.select,
    (finalPos) => blockLogic.save(undefined, finalPos)
  );

  const onConnectStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const x = nodeStates[block.id]?.x || 0;
    const y = nodeStates[block.id]?.y || 0;
    const w = nodeStates[block.id]?.width || 300;
    const h = nodeStates[block.id]?.height || 200;
    
    setConnectionDraft({
      sourceId: block.id,
      startX: x + w / 2,
      startY: y + h / 2,
      currentX: x + w / 2,
      currentY: y + h / 2
    });
  }, [block.id, nodeStates, setConnectionDraft]);
  
  const metadata = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  const template = useMemo(() => {
    const primaryShape = block.shapes[0];
    return templates.find(t => t.name === primaryShape);
  }, [block.shapes, templates]);

  const Renderer = useMemo(() => blockRegistry.getRenderer(block, layer, templates), [block.shapes, layer, templates]);
  const anchor = useMemo(() => blockRegistry.getAnchor(block, nodeStates, templates), [block, nodeStates, templates]);

  // Determine editor mode (Fixed once editing starts to prevent jumping during resize)
  const [activeEditingMode, setActiveEditingMode] = useState<'popup' | 'inline' | null>(null);
  
  useEffect(() => {
    if (blockLogic.isEditing && !activeEditingMode) {
      setActiveEditingMode(blockRegistry.getEditorMode(block, nodeStates, templates));
    } else if (!blockLogic.isEditing) {
      setActiveEditingMode(null);
    }
  }, [blockLogic.isEditing, block, nodeStates, activeEditingMode, templates]);

  const isPopup = activeEditingMode === 'popup';

  return (
    <>
      {Renderer && (
        layer === 'html' ? (
          <div
            style={{
              position: 'absolute',
              left: anchor?.x || 0,
              top: anchor?.y || 0,
              width: anchor?.width || 300,
              height: anchor?.height || 200,
              zIndex: blockLogic.isSelected ? 10 : 1,
              touchAction: 'none'
            }}
            data-node-id={block.id}
            onPointerDown={startDragging}
          >
            <Renderer 
              block={block}
              layer={layer}
              zoom={zoom}
              isSelected={blockLogic.isSelected}
              isEditing={blockLogic.isEditing}
              setIsEditing={blockLogic.setIsEditing}
              onSelect={blockLogic.select}
              onRefresh={onRefresh}
              templates={templates}
            />

            {blockLogic.isSelected && !blockLogic.isEditing && (
              <SelectionFrame 
                size={{ width: anchor?.width || 300, height: anchor?.height || 200 }}
                onResizeStart={startResizing}
                onConnectStart={onConnectStart}
              />
            )}
          </div>
        ) : (
          <Renderer 
            block={block}
            layer={layer}
            zoom={zoom}
            isSelected={blockLogic.isSelected}
            isEditing={blockLogic.isEditing}
            setIsEditing={blockLogic.setIsEditing}
            onSelect={blockLogic.select}
            onRefresh={onRefresh}
            templates={templates}
          />
        )
      )}

      {/* Show Universal Editor in HTML layer only when editing */}
      {layer === 'html' && blockLogic.isEditing && (
        <KyeBlockEditor 
          block={block}
          anchor={anchor || { x: 0, y: 0, width: 0, height: 0 }}
          isPopup={isPopup}
          onClose={() => blockLogic.setIsEditing(false)}
          onRefresh={onRefresh}
        />
      )}
    </>
  );
});

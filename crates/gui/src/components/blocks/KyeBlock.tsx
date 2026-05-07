import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Block, TemplateDto } from '../../types/workspace';
import { useBlock } from '../../hooks/useBlock';
import { blockRegistry } from './renderers/BlockRegistry';
import { KyeBlockEditor } from './KyeBlockEditor';
import { useCanvasStore } from '../../hooks/useCanvasStore';
import { SelectionFrame } from './renderers/SelectionFrame';
import { useResizable } from '../../hooks/useResizable';
import { useDraggable } from '../../hooks/useDraggable';
import { workspaceService } from '../../services/WorkspaceService';

interface KyeBlockProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  templates: TemplateDto[];
  onRefresh: () => void;
}

/**
 * Universal Block Component
 * Orchestrates rendering and interaction logic for any block type.
 */
export const KyeBlock = memo(function KyeBlock({ block, layer, zoom = 1, templates, onRefresh }: KyeBlockProps) {
  const blockLogic = useBlock(block, onRefresh);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  const setConnectionDraft = useCanvasStore(state => state.setConnectionDraft);

  // 1. Interaction Hooks (Resize, Drag, Connect)
  const { startResizing } = useResizable(
    zoom,
    { width: nodeStates[block.id]?.width || 300, height: nodeStates[block.id]?.height || 200 },
    (size) => useCanvasStore.getState().updateNodeState(block.id, size),
    { x: nodeStates[block.id]?.x || 0, y: nodeStates[block.id]?.y || 0 },
    (pos) => useCanvasStore.getState().updateNodeState(block.id, pos),
    (finalPos, finalSize) => blockLogic.save(undefined, { 
      _x: finalPos.x, _y: finalPos.y, _width: finalSize.width, _height: finalSize.height 
    })
  );

  const { startDragging } = useDraggable(
    zoom,
    { x: nodeStates[block.id]?.x || 0, y: nodeStates[block.id]?.y || 0 },
    (pos) => useCanvasStore.getState().updateNodeState(block.id, pos),
    blockLogic.select,
    (finalPos) => blockLogic.save(undefined, { _x: finalPos.x, _y: finalPos.y })
  );

  const onConnectStart = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    const state = nodeStates[block.id] || { x: 0, y: 0, width: 300, height: 200 };
    setConnectionDraft({
      sourceId: block.id,
      startX: state.x + state.width / 2,
      startY: state.y + state.height / 2,
      currentX: state.x + state.width / 2,
      currentY: state.y + state.height / 2
    });
  }, [block.id, nodeStates, setConnectionDraft]);

  const Renderer = useMemo(() => blockRegistry.getRenderer(block, layer, templates), [block.shapes, layer, templates]);
  const anchor = useMemo(() => blockRegistry.getAnchor(block, nodeStates, templates), [block, nodeStates, templates]);
  const features = useMemo(() => blockRegistry.getFeatures(block, templates), [block, templates]);
  
  const [activeEditingMode, setActiveEditingMode] = useState<'popup' | 'inline' | null>(null);
  
  useEffect(() => {
    if (blockLogic.isEditing && !activeEditingMode) {
      setActiveEditingMode(blockRegistry.getEditorMode(block, nodeStates, templates));
    } else if (!blockLogic.isEditing) {
      setActiveEditingMode(null);
    }
  }, [blockLogic.isEditing, block, nodeStates, activeEditingMode, templates]);

  const isPopup = activeEditingMode === 'popup';

  // 3. Rendering - Layer Dispatch
  if (layer === 'svg') {
    return Renderer ? (
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
    ) : null;
  }

  // HTML Layer: Container + Selection + Optional Content
  return (
    <>
      <div
        style={{
          position: 'absolute',
          left: anchor?.x || 0,
          top: anchor?.y || 0,
          width: anchor?.width || 300,
          height: anchor?.height || 200,
          zIndex: blockLogic.isSelected ? 10 : 1,
          touchAction: 'none',
          pointerEvents: (Renderer || features.toolbar || features.resizable) ? 'auto' : 'none'
        }}
        data-node-id={block.id}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement;
          // Ignore if we clicked any interactive element or a handle
          const isInteractive = target.closest('button, a, input, [role="button"], .cursor-pointer, .interactive-handle');
          
          if (!isInteractive && features.draggable !== false) {
            e.stopPropagation(); // Always stop propagation when dragging a block
            startDragging(e);
          }
        }}
      >
        {Renderer && (
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
        )}

        {blockLogic.isSelected && (
          <SelectionFrame 
            size={{ width: anchor?.width || 0, height: anchor?.height || 0 }}
            onResizeStart={startResizing}
            onConnectStart={onConnectStart}
            onDragStart={startDragging}
            onEditStart={() => blockLogic.setIsEditing(true)}
            onDelete={async () => {
              await workspaceService.deleteBlock(block.id);
              onRefresh();
            }}
            features={features}
          />
        )}
      </div>

      {blockLogic.isEditing && (
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
}, (prev, next) => {
  return (
    prev.block.id === next.block.id &&
    prev.block.content === next.block.content &&
    prev.block.metadata === next.block.metadata &&
    prev.layer === next.layer &&
    prev.zoom === next.zoom &&
    JSON.stringify(prev.templates) === JSON.stringify(next.templates) &&
    JSON.stringify(prev.block.shapes) === JSON.stringify(next.block.shapes)
  );
});

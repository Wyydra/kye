import { memo, useMemo, useState, useEffect } from 'react';
import { Block } from '../../types/workspace';
import { useBlock } from '../../hooks/useBlock';
import { blockRegistry } from './renderers/BlockRegistry';
import { KyeBlockEditor } from './KyeBlockEditor';
import { useCanvasStore } from '../../hooks/useCanvasStore';

interface KyeBlockProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  onRefresh: () => void;
}

export const KyeBlock = memo(function KyeBlock({ block, layer, zoom, onRefresh }: KyeBlockProps) {
  const blockLogic = useBlock(block);
  const nodeStates = useCanvasStore(state => state.nodeStates);
  
  const Renderer = useMemo(() => blockRegistry.getRenderer(block, layer), [block.shapes, layer]);
  const anchor = useMemo(() => blockRegistry.getAnchor(block, nodeStates), [block, nodeStates]);

  // Determine editor mode (Fixed once editing starts to prevent jumping during resize)
  const [activeEditingMode, setActiveEditingMode] = useState<'popup' | 'inline' | null>(null);
  
  useEffect(() => {
    if (blockLogic.isEditing && !activeEditingMode) {
      setActiveEditingMode(blockRegistry.getEditorMode(block, nodeStates));
    } else if (!blockLogic.isEditing) {
      setActiveEditingMode(null);
    }
  }, [blockLogic.isEditing, block, nodeStates, activeEditingMode]);

  const isPopup = activeEditingMode === 'popup';

  return (
    <>
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
        />
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

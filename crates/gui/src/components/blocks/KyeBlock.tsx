import React, { memo, useMemo } from 'react';
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
  const isLink = !!(blockLogic.meta.from && blockLogic.meta.to);

  // High-precision selectors: subscribe ONLY to what matters for THIS block
  const state = useCanvasStore(state => state.nodeStates[block.id]);
  const sourceState = useCanvasStore(state => isLink ? state.nodeStates[blockLogic.meta.from] : null);
  const targetState = useCanvasStore(state => isLink ? state.nodeStates[blockLogic.meta.to] : null);
  
  const Renderer = useMemo(() => blockRegistry.getRenderer(block, layer), [block.shapes, layer]);

  const anchor = useMemo(() => {
    if (isLink) {
      if (!sourceState || !targetState) return null;
      return { 
        x: (sourceState.x + sourceState.width/2 + targetState.x + targetState.width/2) / 2 - 50, 
        y: (sourceState.y + sourceState.height/2 + targetState.y + targetState.height/2) / 2 - 12,
        width: 100,
        height: 24
      };
    }
    return state ? { x: state.x, y: state.y, width: state.width, height: state.height } : null;
  }, [isLink, state, sourceState, targetState]);

  // Determine if we should use a popup based on space or type
  const isPopup = useMemo(() => {
    if (!anchor) return false;
    // Always popup for links (too small) or if the card is very small
    return isLink || anchor.width < 200 || anchor.height < 150;
  }, [isLink, anchor]);

  if (layer === 'html' && blockLogic.isEditing) {
    console.log('[KyeBlock] Rendering Editor for:', block.id, { isPopup, anchor });
  }

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

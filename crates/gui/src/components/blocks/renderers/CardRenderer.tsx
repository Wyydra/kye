import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '../../types/workspace';
import { CardBody } from './CardBody';
import { SelectionFrame } from './SelectionFrame';
import { useDraggable } from '../../../hooks/useDraggable';
import { useResizable, HandleType } from '../../../hooks/useResizable';
import { workspaceService } from '../../../services/WorkspaceService';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { cn } from '../../../lib/utils';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';

// Using unified BlockRendererProps

export const CardRenderer = memo(function CardRenderer({ block, zoom, isSelected, isEditing, setIsEditing, onSelect, onRefresh }: BlockRendererProps) {
  const initialMeta = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  const { updateNodeState, removeNodeState, setConnectionDraft } = useCanvasStore();

  const [content, setContent] = useState(block?.content ?? '');
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMeta);
  const [pos, setPos] = useState({ x: initialMeta.x ?? 0, y: initialMeta.y ?? 0 });
  const [size, setSize] = useState({ width: initialMeta.width ?? 300, height: initialMeta.height ?? 200 });

  // Sync to store for edge rendering
  useEffect(() => {
    updateNodeState(block.id, { ...pos, ...size });
  }, [block.id, pos, size, updateNodeState]);

  useEffect(() => {
    return () => removeNodeState(block.id);
  }, [block.id, removeNodeState]);

  const lastBlockMetadata = useRef(block?.metadata);
  const lastBlockContent = useRef(block?.content);

  const saveNode = useCallback(async (newPos?: typeof pos, newSize?: typeof size, newContent?: string, newMeta?: typeof metadata) => {
    const finalPos = newPos ?? pos;
    const finalSize = newSize ?? size;
    const finalContent = newContent ?? content;
    const finalMeta = newMeta ?? metadata;

    const fullMetadata = {
      ...finalMeta,
      x: Math.round(finalPos.x),
      y: Math.round(finalPos.y),
      width: Math.round(finalSize.width),
      height: Math.round(finalSize.height)
    };

    const contentChanged = finalContent !== block.content;
    const metaStr = JSON.stringify(fullMetadata);
    const metaChanged = metaStr !== block.metadata;

    if (contentChanged || metaChanged) {
      try {
        await workspaceService.updateBlock(
          block.id,
          contentChanged ? finalContent : null,
          metaChanged ? metaStr : null
        );
      } catch (e) {
        console.error('Failed to save block:', e);
      }
    }
  }, [block.id, block.content, block.metadata, content, metadata, pos, size]);

  const { startDragging } = useDraggable(
    zoom,
    pos,
    setPos,
    onSelect,
    (finalPos) => saveNode(finalPos)
  );

  const { startResizing } = useResizable(
    zoom,
    size,
    setSize,
    pos,
    setPos,
    (finalPos, finalSize) => saveNode(finalPos, finalSize)
  );

  useEffect(() => {
    if (block?.metadata !== lastBlockMetadata.current) {
      lastBlockMetadata.current = block?.metadata;
      if (!isEditing) {
        try {
          const meta = JSON.parse(block?.metadata ?? '{}');
          setMetadata(meta);
          setPos(p => ({ x: meta.x ?? p.x, y: meta.y ?? p.y }));
          setSize(s => ({ width: meta.width ?? s.width, height: meta.height ?? s.height }));
        } catch {}
      }
    }
    if (block?.content !== lastBlockContent.current) {
      lastBlockContent.current = block?.content;
      if (!isEditing) setContent(block?.content ?? '');
    }
  }, [block.metadata, block.content, isEditing]);


  return (
    <div 
      data-node-id={block.id}
      className={cn(
        "absolute group transition-shadow",
        isSelected ? "z-[100]" : "z-[1]"
      )}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        width: size.width,
        height: size.height,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".node-header")) {
          startDragging(e);
        } else {
          onSelect();
        }
      }}
    >
      {/* Visual Content Container */}
      <div className={cn(
        "flex flex-col w-full h-full overflow-hidden rounded-lg border bg-card shadow-sm transition-all",
        isSelected ? "border-primary/50 shadow-xl" : "hover:shadow-md border-border"
      )}>
        <div className={cn(
          "node-header flex items-center justify-between border-b px-3 py-1 bg-muted/30 cursor-grab active:cursor-grabbing transition-opacity duration-200",
          isEditing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {block.shapes[0] || 'Node'}
          </span>
          {/* This internal button is now redundant with KyeBlockEditor but kept for fallback */}
          {isSelected && !isEditing && block.content !== content && (
            <button 
              className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary hover:text-primary-foreground" 
              onClick={(e) => { e.stopPropagation(); handleSave(); }}
            >
              SAVE
            </button>
          )}
        </div>
        
        <div 
          className={cn(
            "flex-1 overflow-auto transition-opacity duration-200",
            isEditing ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <CardBody 
            block={block} 
            isEditing={false}
            onEditToggle={() => setIsEditing(true)}
            content={content}
            setContent={setContent}
            metadata={metadata}
            onMetadataChange={setMetadata}
          />
        </div>
      </div>

      {/* Selection Frame & Handles */}
      {isSelected && (
        <SelectionFrame 
          size={size}
          onResizeStart={startResizing}
          onEdit={() => setIsEditing(true)}
          onConnectStart={() => {
            setConnectionDraft({
              sourceId: block.id,
              mouseX: pos.x + size.width,
              mouseY: pos.y + size.height / 2
            });
          }}
        />
      )}
    </div>
  );
});

// Auto-registration
blockRegistry.register({
  priority: 0, // Lower priority, catch-all for top-level nodes
  match: (_, meta) => !meta.from && !meta.to && !meta.parent,
  html: CardRenderer
});

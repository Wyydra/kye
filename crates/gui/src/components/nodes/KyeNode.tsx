import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '../../types/workspace';
import { KyeNodeContent } from './KyeNodeContent';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable, HandleType } from '../../hooks/useResizable';
import { workspaceService } from '../../services/WorkspaceService';
import { cn } from '../../lib/utils';

interface KyeNodeProps {
  block: Block;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
}

export const KyeNode = memo(function KyeNode({ block, zoom, isSelected, onSelect }: KyeNodeProps) {
  const initialMeta = useMemo(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  }, [block.metadata]);

  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMeta);
  const [pos, setPos] = useState({ x: initialMeta.x ?? 0, y: initialMeta.y ?? 0 });
  const [size, setSize] = useState({ width: initialMeta.width ?? 300, height: initialMeta.height ?? 200 });

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

  const handleEditToggle = async () => {
    if (isEditing) {
      setIsEditing(false);
      await saveNode();
    } else {
      setIsEditing(true);
    }
  };

  return (
    <div 
      className={cn(
        "absolute flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow",
        isSelected ? "ring-2 ring-primary border-primary/50 shadow-xl" : "hover:shadow-md"
      )}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        width: size.width,
        height: size.height,
        zIndex: isSelected ? 100 : 1,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(".node-header")) {
          startDragging(e);
        } else {
          onSelect();
        }
      }}
    >
      <div className="node-header flex items-center justify-between border-b px-3 py-1 bg-muted/30 cursor-grab active:cursor-grabbing">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {block.shapes[0] || 'Node'}
        </span>
        {isEditing && (
          <button 
            className="rounded bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground hover:bg-primary/90" 
            onClick={handleEditToggle}
          >
            SAVE
          </button>
        )}
      </div>
      
      <div className="flex-1 overflow-auto">
        <KyeNodeContent 
          block={block} 
          isEditing={isEditing}
          onEditToggle={handleEditToggle}
          content={content}
          setContent={setContent}
          metadata={metadata}
          onMetadataChange={setMetadata}
        />
      </div>

      {/* Resize Handles */}
      {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map(type => (
        <div 
          key={type} 
          className={cn(
            "absolute h-3 w-3 z-10",
            type === 'nw' && "top-0 left-0 cursor-nw-resize",
            type === 'ne' && "top-0 right-0 cursor-ne-resize",
            type === 'sw' && "bottom-0 left-0 cursor-sw-resize",
            type === 'se' && "bottom-0 right-0 cursor-se-resize",
            isSelected ? "opacity-100" : "opacity-0"
          )} 
          onPointerDown={(e) => startResizing(e, type)} 
        />
      ))}
      {(['n', 's', 'e', 'w'] as HandleType[]).map(type => (
        <div 
          key={type} 
          className={cn(
            "absolute z-0",
            type === 'n' && "top-0 left-0 right-0 h-1 cursor-n-resize",
            type === 's' && "bottom-0 left-0 right-0 h-1 cursor-s-resize",
            type === 'e' && "top-0 bottom-0 right-0 w-1 cursor-e-resize",
            type === 'w' && "top-0 bottom-0 left-0 w-1 cursor-w-resize",
            isSelected ? "opacity-100" : "opacity-0"
          )} 
          onPointerDown={(e) => startResizing(e, type)} 
        />
      ))}
    </div>
  );
});

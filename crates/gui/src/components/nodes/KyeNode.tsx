import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '../../types/workspace';
import { KyeNodeContent } from './KyeNodeContent';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable, HandleType } from '../../hooks/useResizable';
import { workspaceService } from '../../services/WorkspaceService';
import { useCanvasStore } from '../../hooks/useCanvasStore';
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

  const { updateNodeState, removeNodeState, setConnectionDraft } = useCanvasStore();

  const [isEditing, setIsEditing] = useState(false);
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
      </div>

      {/* Selection Frame & Handles (Offset & Outside Overflow) */}
      {isSelected && (
        <div 
          className="absolute pointer-events-none"
          style={{
            top: -6,
            left: -6,
            right: -6,
            bottom: -6,
            border: '2px solid hsl(var(--primary))',
            borderRadius: '12px',
            zIndex: 101
          }}
        >
          {/* Corner Handles (Floating) */}
          {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map(type => (
            <div 
              key={type} 
              className={cn(
                "absolute h-3.5 w-3.5 pointer-events-auto bg-background border-2 border-primary rounded-full shadow-md hover:scale-125 transition-transform",
                type === 'nw' && "-top-2 -left-2 cursor-nw-resize",
                type === 'ne' && "-top-2 -right-2 cursor-ne-resize",
                type === 'sw' && "-bottom-2 -left-2 cursor-sw-resize",
                type === 'se' && "-bottom-2 -right-2 cursor-se-resize"
              )} 
              onPointerDown={(e) => {
                e.stopPropagation();
                startResizing(e, type);
              }} 
            />
          ))}
          
          {/* Edge Interaction Zones */}
          {(['n', 's', 'e', 'w'] as HandleType[]).map(type => (
            <div 
              key={type} 
              className={cn(
                "absolute pointer-events-auto",
                type === 'n' && "top-0 left-4 right-4 h-3 -translate-y-1/2 cursor-n-resize",
                type === 's' && "bottom-0 left-4 right-4 h-3 translate-y-1/2 cursor-s-resize",
                type === 'e' && "top-4 bottom-4 right-0 w-3 translate-x-1/2 cursor-e-resize",
                type === 'w' && "top-4 bottom-4 left-0 w-3 -translate-x-1/2 cursor-w-resize"
              )} 
              onPointerDown={(e) => {
                e.stopPropagation();
                startResizing(e, type);
              }} 
            />
          ))}

          {/* Connection Handle (Floating) */}
          <div 
            className="absolute -right-8 top-1/2 -translate-y-1/2 group pointer-events-auto"
            onPointerDown={(e) => {
              e.stopPropagation();
              setConnectionDraft({
                sourceId: block.id,
                mouseX: pos.x + size.width,
                mouseY: pos.y + size.height / 2
              });
            }}
          >
            <div className="h-7 w-7 rounded-full bg-background border-2 border-primary flex items-center justify-center cursor-crosshair shadow-lg group-hover:bg-primary transition-all">
              <div className="w-2.5 h-2.5 rounded-full bg-primary group-hover:bg-background" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

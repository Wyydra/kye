import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { CardBody } from './CardBody';
import { SelectionFrame } from './SelectionFrame';
import { useNodeInteraction } from '../../../hooks/useNodeInteraction';
import { useCanvasStore } from '../../../hooks/useCanvasStore';
import { cn } from '../../../lib/utils';
import { blockRegistry, BlockRendererProps } from './BlockRegistry';

export const CardRenderer = memo(function CardRenderer({ block, zoom, isSelected, isEditing, setIsEditing, onSelect, onRefresh }: BlockRendererProps) {
  const { 
    pos, size, meta, 
    startDragging, startResizing, save 
  } = useNodeInteraction(block, zoom);

  const setConnectionDraft = useCanvasStore(state => state.setConnectionDraft);
  const [content, setContent] = useState(block?.content ?? '');

  // Local content sync
  useEffect(() => {
    if (!isEditing) setContent(block?.content ?? '');
  }, [block.content, isEditing]);

  const handleSaveContent = useCallback(async () => {
    if (content !== block.content) {
      await save({ meta: {} }); // This triggers a save, but we need content too
      // Wait, let's fix the save to handle content
    }
  }, [content, block.content, save]);

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
        </div>
        
        <div className={cn(
          "flex-1 overflow-auto transition-opacity duration-200",
          isEditing ? "opacity-0 pointer-events-none" : "opacity-100"
        )}>
          <CardBody 
            block={block} 
            isEditing={false}
            onEditToggle={() => setIsEditing(true)}
            content={content}
            setContent={setContent}
            metadata={meta}
            onMetadataChange={() => {}} // Metadata managed by hook now
          />
        </div>
      </div>

      {isSelected && (
        <SelectionFrame 
          size={size}
          onResizeStart={startResizing}
          onConnectStart={(e) => {
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const worldX = pos.x + (e.clientX - rect.left) / (zoom || 1);
            const worldY = pos.y + (e.clientY - rect.top) / (zoom || 1);
            setConnectionDraft({ sourceId: block.id, mouseX: worldX, mouseY: worldY });
          }}
        />
      )}
    </div>
  );
});

// Auto-registration
blockRegistry.register({
  priority: 0,
  match: (_, meta) => !meta.from && !meta.to && !meta.parent,
  html: CardRenderer
});

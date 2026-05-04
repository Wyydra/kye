import { memo, useMemo, useState, useEffect, useRef } from 'react';
import { Block } from '../../../types/workspace';
import { contentRegistry } from './ContentRegistry';

interface CardBodyProps {
  block: Block;
  isEditing: boolean;
  onEditToggle: () => void;
  content: string;
  setContent: (content: string) => void;
  metadata: Record<string, unknown>;
  onMetadataChange: (meta: Record<string, unknown>) => void;
}

export const CardBody = memo(function CardBody({ 
  block, 
  onEditToggle,
  content,
  metadata,
}: CardBodyProps) {
  const renderer = useMemo(() => contentRegistry.getRenderer(block?.shapes ?? []), [block?.shapes]);
  
  if (!block) return null;

  return (
    <div 
      className="w-full h-full flex flex-col"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEditToggle();
      }}
    >
      {renderer ? (
        <renderer.view id={block.id} markdown={content} metadata={metadata} />
      ) : (
        <div className="p-4 text-sm italic text-muted-foreground">
          Double-click to add content...
        </div>
      )}
    </div>
  );
});

import React, { memo, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Block } from '../../types/workspace';
import { KyeNodeContent } from './KyeNodeContent';
import styles from './KyeNodeFrame.module.css';
import { useDraggable } from '../../hooks/useDraggable';
import { useResizable, HandleType } from '../../hooks/useResizable';
import { invoke } from '@tauri-apps/api/core';

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

  // Unified Node State
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  
  // Dumb Client: Metadata is the source of truth, no filtering.
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMeta);
  const [pos, setPos] = useState({ x: initialMeta.x ?? 0, y: initialMeta.y ?? 0 });
  const [size, setSize] = useState({ width: initialMeta.width ?? 300, height: initialMeta.height ?? 200 });

  // Sync refs for change detection
  const lastBlockMetadata = useRef(block?.metadata);
  const lastBlockContent = useRef(block?.content);

  // Persistence handler
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
        await invoke('update_block', {
          id: block.id,
          content: contentChanged ? finalContent : null,
          metadata: metaChanged ? metaStr : null,
        });
      } catch (e) {
        console.error('Failed to save block:', e);
      }
    }
  }, [block.id, block.content, block.metadata, content, metadata, pos, size]);

  // Dragging logic
  const { startDragging } = useDraggable(
    zoom,
    pos,
    setPos,
    onSelect,
    (finalPos) => saveNode(finalPos)
  );

  // Resizing logic
  const { startResizing } = useResizable(
    zoom,
    size,
    setSize,
    pos,
    setPos,
    (finalPos, finalSize) => saveNode(finalPos, finalSize)
  );

  // External sync
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
      className={`${styles.nodeFrame} ${isSelected ? styles.selected : ''}`}
      style={{
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        width: size.width,
        height: size.height,
        zIndex: isSelected ? 100 : 1,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).closest(`.${styles.header}`)) {
          startDragging(e);
        } else {
          onSelect();
        }
      }}
    >
      <div className={styles.header}>
        <span className={styles.title}>{block.shapes[0] || 'Node'}</span>
        {isEditing && (
          <button className={styles.saveButton} onClick={handleEditToggle}>Save</button>
        )}
      </div>
      
      <div className={styles.content}>
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

      {(['nw', 'ne', 'sw', 'se'] as HandleType[]).map(type => (
        <div key={type} className={`${styles.transformHandle} ${styles[type]}`} onPointerDown={(e) => startResizing(e, type)} />
      ))}
      {(['n', 's', 'e', 'w'] as HandleType[]).map(type => (
        <div key={type} className={`${styles.edgeHandle} ${styles[type]}`} onPointerDown={(e) => startResizing(e, type)} />
      ))}
    </div>
  );
});

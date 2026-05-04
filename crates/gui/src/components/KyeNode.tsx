import React, { memo, useState, useEffect, useRef } from 'react';
import { Block } from '../types/workspace';
import { KyeNodeContent } from './nodes/KyeNodeContent';
import styles from './KyeNodeFrame.module.css';
import { invoke } from '@tauri-apps/api/core';

interface KyeNodeProps {
  block: Block;
  zoom: number;
  isSelected: boolean;
  onSelect: () => void;
}

type HandleType = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export const KyeNode = memo(function KyeNode({ block, zoom, isSelected, onSelect }: KyeNodeProps) {
  const initialMeta = (() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  })();

  const [pos, setPos] = useState({ x: initialMeta.x ?? 0, y: initialMeta.y ?? 0 });
  const [size, setSize] = useState({ width: initialMeta.width ?? 300, height: initialMeta.height ?? 200 });
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  const [metadata, setMetadata] = useState<Record<string, unknown>>(initialMeta);

  // Sync from backend
  const lastBlockMetadata = useRef(block?.metadata);
  const lastBlockContent = useRef(block?.content);

  useEffect(() => {
    // Sync Pos/Size
    try {
      const meta = JSON.parse(block.metadata);
      setPos({ x: meta.x ?? pos.x, y: meta.y ?? pos.y });
      setSize({ width: meta.width ?? size.width, height: meta.height ?? size.height });
    } catch {}

    // Sync Content/Metadata if changed externally
    if (block?.metadata !== lastBlockMetadata.current) {
      lastBlockMetadata.current = block?.metadata;
      if (!isEditing) {
        try { setMetadata(JSON.parse(block?.metadata ?? '{}')); } catch { setMetadata({}); }
      }
    }
    if (block?.content !== lastBlockContent.current) {
      lastBlockContent.current = block?.content;
      if (!isEditing) {
        setContent(block?.content ?? '');
      }
    }
  }, [block.metadata, block.content, isEditing]);

  const saveLayout = async (x: number, y: number, w: number, h: number) => {
    const meta = { ...metadata, x, y, width: w, height: h };
    try {
      await invoke('update_block', {
        id: block.id,
        content: null,
        metadata: JSON.stringify(meta),
      });
    } catch (e) {
      console.error('Failed to save layout:', e);
    }
  };

  const handleEditToggle = async () => {
    if (isEditing) {
      setIsEditing(false);
      const contentChanged = content !== block.content;
      const metaChanged = JSON.stringify(metadata) !== block.metadata;
      if (contentChanged || metaChanged) {
        try {
          await invoke('update_block', {
            id: block.id,
            content: contentChanged ? content : null,
            metadata: metaChanged ? JSON.stringify(metadata) : null,
          });
        } catch (e) {
          console.error('Failed to save block:', e);
        }
      }
    } else {
      setIsEditing(true);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    onSelect();
    
    if ((e.target as HTMLElement).closest(`.${styles.header}`)) {
      const startX = e.clientX;
      const startY = e.clientY;
      const startNodeX = pos.x;
      const startNodeY = pos.y;

      const onMove = (moveEvent: PointerEvent) => {
        const dx = (moveEvent.clientX - startX) / zoom;
        const dy = (moveEvent.clientY - startY) / zoom;
        setPos({ x: startNodeX + dx, y: startNodeY + dy });
      };

      const onUp = (upEvent: PointerEvent) => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const dx = (upEvent.clientX - startX) / zoom;
        const dy = (upEvent.clientY - startY) / zoom;
        saveLayout(Math.round(startNodeX + dx), Math.round(startNodeY + dy), size.width, size.height);
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    }
  };

  const handleResizeStart = (e: React.PointerEvent, type: HandleType) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = size.width;
    const startH = size.height;
    const startXpos = pos.x;
    const startYpos = pos.y;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      
      let newW = startW;
      let newH = startH;
      let newX = startXpos;
      let newY = startYpos;

      if (type.includes('e')) newW = Math.max(150, startW + dx);
      if (type.includes('s')) newH = Math.max(100, startH + dy);
      if (type.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= 150) {
          newW = potentialW;
          newX = startXpos + dx;
        }
      }
      if (type.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= 100) {
          newH = potentialH;
          newY = startYpos + dy;
        }
      }
      
      setPos({ x: newX, y: newY });
      setSize({ width: newW, height: newH });
    };

    const onUp = (upEvent: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      
      const dx = (upEvent.clientX - startX) / zoom;
      const dy = (upEvent.clientY - startY) / zoom;
      let finalW = startW;
      let finalH = startH;
      let finalX = startXpos;
      let finalY = startYpos;

      if (type.includes('e')) finalW = Math.max(150, startW + dx);
      if (type.includes('s')) finalH = Math.max(100, startH + dy);
      if (type.includes('w')) {
        const potentialW = startW - dx;
        if (potentialW >= 150) {
          finalW = potentialW;
          finalX = startXpos + dx;
        }
      }
      if (type.includes('n')) {
        const potentialH = startH - dy;
        if (potentialH >= 100) {
          finalH = potentialH;
          finalY = startYpos + dy;
        }
      }

      saveLayout(Math.round(finalX), Math.round(finalY), Math.round(finalW), Math.round(finalH));
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
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
      onPointerDown={handlePointerDown}
    >
      <div className={styles.header}>
        <span className={styles.title}>{block.shapes[0] || 'Node'}</span>
        
        {isEditing && (
          <button 
            onClick={handleEditToggle}
            style={{ 
              marginLeft: 'auto',
              background: 'rgba(95, 149, 255, 0.15)',
              border: '1px solid rgba(95, 149, 255, 0.3)',
              borderRadius: '4px',
              color: '#5f95ff',
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(95, 149, 255, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(95, 149, 255, 0.5)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'rgba(95, 149, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(95, 149, 255, 0.3)';
            }}
          >
            Save
          </button>
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

      <div className={`${styles.transformHandle} ${styles.nw}`} onPointerDown={(e) => handleResizeStart(e, 'nw')} />
      <div className={`${styles.transformHandle} ${styles.ne}`} onPointerDown={(e) => handleResizeStart(e, 'ne')} />
      <div className={`${styles.transformHandle} ${styles.sw}`} onPointerDown={(e) => handleResizeStart(e, 'sw')} />
      <div className={`${styles.transformHandle} ${styles.se}`} onPointerDown={(e) => handleResizeStart(e, 'se')} />
      
      <div className={`${styles.edgeHandle} ${styles.n}`} onPointerDown={(e) => handleResizeStart(e, 'n')} />
      <div className={`${styles.edgeHandle} ${styles.s}`} onPointerDown={(e) => handleResizeStart(e, 's')} />
      <div className={`${styles.edgeHandle} ${styles.e}`} onPointerDown={(e) => handleResizeStart(e, 'e')} />
      <div className={`${styles.edgeHandle} ${styles.w}`} onPointerDown={(e) => handleResizeStart(e, 'w')} />
    </div>
  );
});

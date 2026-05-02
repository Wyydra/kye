import React, { useState, useEffect, useRef } from 'react';
import { Node as X6Node } from '@antv/x6';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { invoke } from '@tauri-apps/api/core';
import { Block } from '../types/workspace';
import styles from './Node.module.css';

interface NodeProps {
  node?: X6Node;
}

export const Node: React.FC<NodeProps> = ({ node }) => {
  const block = node?.getData<Block>();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external content updates from the file watcher (only when not actively editing)
  useEffect(() => {
    if (!isEditing) setContent(block?.content ?? '');
  }, [block?.content, isEditing]);

  // Auto-resize the X6 node to fit content
  useEffect(() => {
    if (!containerRef.current || !node) return;
    const observer = new ResizeObserver(() => {
      const height = containerRef.current!.scrollHeight;
      const { width } = node.size();
      if (Math.abs(node.size().height - height) > 2) {
        node.resize(width, Math.max(80, height));
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [node]);

  const handleSave = async () => {
    setIsEditing(false);
    if (!block || content === block.content) return;
    try {
      await invoke('update_block', { id: block.id, content, metadata: null });
    } catch (e) {
      console.error('Failed to save block:', e);
    }
  };

  if (!block) return null;

  return (
    <div
      ref={containerRef}
      className={`${styles.blockNode} ${isEditing ? styles.isEditing : ''}`}
      onDoubleClick={() => !isEditing && setIsEditing(true)}
    >
      <div className={styles.blockHeader}>
        <span className={styles.blockBadge}>{block.shapes[0] ?? 'Text'}</span>
        {isEditing && (
          <button className={styles.btnDone} onClick={handleSave}>Done</button>
        )}
      </div>

      <div
        className={styles.blockContent}
        onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
      >
        <CodeMirror
          value={content}
          extensions={[markdown()]}
          theme={oneDark}
          editable={isEditing}
          basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: isEditing }}
          onChange={setContent}
        />
      </div>
    </div>
  );
};

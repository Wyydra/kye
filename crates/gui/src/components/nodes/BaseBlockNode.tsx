import React, { memo } from 'react';
import styles from './BaseBlockNode.module.css';

interface BaseBlockNodeProps {
  type: string;
  isEditing: boolean;
  onEditToggle: () => void;
  children: React.ReactNode;
}

export const BaseBlockNode = memo(function BaseBlockNode({
  type,
  isEditing,
  onEditToggle,
  children,
}: BaseBlockNodeProps) {
  return (
    <div
      className={`${styles.blockNode} ${isEditing ? styles.isEditing : ''}`}
      onDoubleClick={() => !isEditing && onEditToggle()}
    >
      <div className={styles.header}>
        <span className={styles.badge}>{type}</span>
        <button className={styles.editBtn} onClick={onEditToggle} title={isEditing ? 'Save' : 'Edit'}>
          {isEditing ? '✓' : '✎'}
        </button>
      </div>

      <div
        className={styles.content}
        onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
        onKeyDown={isEditing ? (e) => e.stopPropagation() : undefined}
      >
        {children}
      </div>
    </div>
  );
});

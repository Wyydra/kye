import type { ReactNode } from 'react';
import { memo } from 'react';

interface BaseBlockNodeProps {
  id: string;
  type: string;
  selected: boolean;
  isEditing: boolean;
  setEditing: (editing: boolean) => void;
  children: ReactNode;
}

export const BaseBlockNode = memo(function BaseBlockNode({ 
  id: _id, 
  type, 
  selected, 
  isEditing, 
  setEditing, 
  children 
}: BaseBlockNodeProps) {
  return (
    <div 
      className={`block-node block-type-${type} ${selected ? 'is-selected' : ''} ${isEditing ? 'is-editing' : ''}`}
      style={{ border: '2px solid var(--x6-edge-color)' }} /* TEST BORDER */
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!isEditing) setEditing(true);
      }}
    >
      <div className="block-type-badge">{type}</div>
      
      <div className="block-node-controls">
        <button 
          className="control-btn" 
          onClick={(e) => {
            e.stopPropagation();
            setEditing(!isEditing);
          }}
          title={isEditing ? "Save changes" : "Edit block"}
        >
          {isEditing ? '✓' : '✎'}
        </button>
      </div>

      <div className="block-node-content" style={{ position: 'relative', width: '100%', height: '100%' }}>
        {children}
      </div>
    </div>
  );
});

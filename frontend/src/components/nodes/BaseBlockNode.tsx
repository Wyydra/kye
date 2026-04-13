import type { ReactNode } from 'react';
import { memo } from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';

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
    <>
      <NodeResizer 
        isVisible={selected} 
        minWidth={type === 'text' ? 250 : 150} 
        minHeight={150} 
        color="#3b82f6" 
      />
      <div 
        className={`block-node block-type-${type} ${selected ? 'is-selected' : ''} ${isEditing ? 'is-editing' : ''}`} 
        style={{ padding: '4px' }}
        onDoubleClick={() => !isEditing && setEditing(true)}
      >
        <div className="block-type-badge">{type}</div>
        
        <div className="block-node-controls nodrag">
          <button 
            className="control-btn" 
            onClick={() => setEditing(!isEditing)}
            title={isEditing ? "Save changes" : "Edit block"}
          >
            {isEditing ? '✓' : '✎'}
          </button>
        </div>

        <Handle type="source" position={Position.Top} id="top" className="block-node-handle" />
        <Handle type="source" position={Position.Right} id="right" className="block-node-handle" />
        
        <div className={`block-node-content ${isEditing ? "nodrag nopan" : ""}`} style={{ position: 'relative', width: '100%', height: '100%' }}>
          {children}
        </div>
        
        <Handle type="source" position={Position.Bottom} id="bottom" className="block-node-handle" />
        <Handle type="source" position={Position.Left} id="left" className="block-node-handle" />
      </div>
    </>
  );
});

import React from 'react';
import { Node as X6Node } from '@antv/x6';
import { Block } from '../types/workspace';

interface NodeProps {
  node?: X6Node;
}

export const Node: React.FC<NodeProps> = ({ node }) => {
  const data = node?.getData<Block>();

  if (!data) return null;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: '#ffffff',
      border: '2px solid #5F95FF',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      padding: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{
        fontSize: '11px',
        fontWeight: 'bold',
        color: '#5F95FF',
        marginBottom: '6px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {data.shapes && data.shapes.length > 0 ? data.shapes.join(', ') : 'Generic Block'}
      </div>
      <div style={{
        flex: 1,
        color: '#333333',
        fontSize: '13px',
        lineHeight: 1.5,
        wordBreak: 'break-word',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }}>
        {data.content || 'Empty Content'}
      </div>
    </div>
  );
};

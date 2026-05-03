import { memo } from 'react';
import type { NodeRendererProps } from './NodeRendererRegistry';
import { registry } from './NodeRendererRegistry';

// Simple markdown viewer - renders raw content with whitespace preserved.
// Swap this for react-markdown or any renderer without touching KyeNode.
const TextViewer = memo(function TextViewer({ markdown }: NodeRendererProps) {
  return (
    <div style={{
      padding: '8px 10px',
      fontSize: '13px',
      lineHeight: 1.7,
      color: '#c5c5e0',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {markdown || <span style={{ color: '#45455e', fontStyle: 'italic' }}>Empty</span>}
    </div>
  );
});

export const TextNode = TextViewer;

registry.register('text', { view: TextViewer });

import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import type { NodeRendererProps } from './NodeRendererRegistry';
import { registry } from './NodeRendererRegistry';

const TextViewer = memo(({ markdown }: NodeRendererProps) => (
  <div className="tiptap-container readonly" style={{ height: '100%', width: '100%' }}>
    <div className="tiptap markdown-preview">
      <ReactMarkdown>{markdown || ''}</ReactMarkdown>
    </div>
  </div>
));

// Register only the view component
registry.register('text', {
  view: TextViewer
});

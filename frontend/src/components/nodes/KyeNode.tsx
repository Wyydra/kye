import { memo, useMemo, useState } from 'react';
import type { Node, NodeProps } from '@xyflow/react';
import { BaseBlockNode } from './BaseBlockNode';
import { registry } from './NodeRendererRegistry';
import { PropertyEditor } from '../editors/PropertyEditor';
import { TiptapEditor } from '../editors/TiptapEditor';

export type KyeNodeData = {
  markdown: string;
  metadata?: Record<string, any>;
  shapes: string[];
  isEditing: boolean;
  onMarkdownChange: (id: string, newMarkdown: string) => void;
  onMetadataChange: (id: string, newMetadata: Record<string, any>) => void;
  setEditing: (editing: boolean) => void;
  [key: string]: unknown;
};

export type KyeNode = Node<KyeNodeData, 'kye-node'>;

export const KyeNodeComponent = memo(function KyeNodeComponent({ id, data, selected }: NodeProps<KyeNode>) {
  const { shapes, isEditing, markdown, metadata, onMarkdownChange, onMetadataChange, setEditing } = data;
  const [clickCoords] = useState<{ x: number, y: number } | null>(null);

  // Find the renderer based on shapes for VIEW mode
  const renderer = useMemo(() => registry.getRenderer(shapes), [shapes]);

  // Determine the primary type for display/badges
  const primaryType = shapes.find(s => s !== 'text') || 'text';

  if (isEditing) {
    return (
      <BaseBlockNode 
        id={id} 
        type={primaryType} 
        selected={selected} 
        isEditing={true} 
        setEditing={setEditing}
      >
        <div className="unified-editor">
          <PropertyEditor 
            metadata={metadata || {}} 
            onMetadataChange={(newMeta) => onMetadataChange(id, newMeta)} 
          />
          <div className="editor-separator" />
          <div 
            className="tiptap-container" 
            style={{ height: '200px', cursor: 'text' }}
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <TiptapEditor
              initialValue={markdown}
              onChange={(newMd) => onMarkdownChange(id, newMd)}
              readOnly={false}
              clickCoords={clickCoords}
            />
          </div>
        </div>
      </BaseBlockNode>
    );
  }

  // View Mode
  if (!renderer) {
    return (
      <BaseBlockNode id={id} type="unknown" selected={selected} isEditing={false} setEditing={() => {}}>
        <div style={{ padding: '20px', color: '#ef4444' }}>Unknown Node Type: {shapes.join(', ')}</div>
      </BaseBlockNode>
    );
  }

  return (
    <BaseBlockNode 
      id={id} 
      type={primaryType} 
      selected={selected} 
      isEditing={false} 
      setEditing={setEditing}
    >
      <renderer.view
        id={id}
        markdown={markdown}
        metadata={metadata}
      />
    </BaseBlockNode>
  );
});

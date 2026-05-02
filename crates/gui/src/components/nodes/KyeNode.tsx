// Import shape renderers to auto-register them in the registry
import './TextNode';
import './ImageNode';

import { memo, useMemo, useState, useEffect } from 'react';
import { Node as X6Node } from '@antv/x6';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { invoke } from '@tauri-apps/api/core';
import { Block } from '../../types/workspace';
import { registry } from './NodeRendererRegistry';
import { BaseBlockNode } from './BaseBlockNode';
import { PropertyEditor } from '../editors/PropertyEditor';

interface KyeNodeProps {
  node?: X6Node;
}

export const KyeNode = memo(function KyeNode({ node }: KyeNodeProps) {
  const block = node?.getData<Block>();
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});

  // Parse metadata JSON string once, sync when block changes
  useEffect(() => {
    try { setMetadata(JSON.parse(block?.metadata ?? '{}')); } catch { setMetadata({}); }
  }, [block?.metadata]);

  // Sync content from external file watcher updates (only when not actively editing)
  useEffect(() => {
    if (!isEditing) setContent(block?.content ?? '');
  }, [block?.content, isEditing]);

  const renderer = useMemo(() => registry.getRenderer(block?.shapes ?? []), [block?.shapes]);
  const primaryType = block?.shapes.find(s => s !== 'text') ?? block?.shapes[0] ?? 'text';

  const handleEditToggle = async () => {
    if (isEditing) {
      setIsEditing(false);
      if (!block) return;
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

  if (!block) return null;

  return (
    <BaseBlockNode type={primaryType} isEditing={isEditing} onEditToggle={handleEditToggle}>
      {isEditing ? (
        <>
          <PropertyEditor
            blockType={primaryType}
            metadata={metadata}
            onMetadataChange={setMetadata}
          />
          <CodeMirror
            value={content}
            extensions={[markdown()]}
            theme={oneDark}
            basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true }}
            onChange={setContent}
          />
        </>
      ) : renderer ? (
        <renderer.view id={block.id} markdown={content} metadata={metadata} />
      ) : (
        <div style={{ padding: '8px', color: '#ef4444', fontSize: '12px' }}>
          Unknown type: {block.shapes.join(', ')}
        </div>
      )}
    </BaseBlockNode>
  );
});


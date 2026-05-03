import { memo, useMemo, useState, useEffect, useRef } from 'react';
import AceEditor from 'react-ace';
import { Ace } from 'ace-builds';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/theme-one_dark';
import 'ace-builds/src-noconflict/ext-language_tools';

import { invoke } from '@tauri-apps/api/core';
import { Block } from '../../types/workspace';
import { registry } from './NodeRendererRegistry';
import { PropertyEditor } from '../editors/PropertyEditor';
import { eventBus } from '../../lib/eventBus';

interface KyeNodeContentProps {
  block: Block;
}

export const KyeNodeContent = memo(function KyeNodeContent({ block }: KyeNodeContentProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(block?.content ?? '');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const editorRef = useRef<Ace.Editor | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (editorRef.current) {
        editorRef.current.resize();
      }
    };

    eventBus.on('layout:resize', handleResize);
    return () => {
      eventBus.off('layout:resize', handleResize);
    };
  }, []);

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
    <div 
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      onDoubleClick={() => !isEditing && handleEditToggle()}
    >
      {isEditing ? (
        <>
          <PropertyEditor
            blockType={primaryType}
            metadata={metadata}
            onMetadataChange={setMetadata}
          />
          <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AceEditor
              onLoad={(editor) => {
                editorRef.current = editor;
              }}
              mode="markdown"
              theme="one_dark"
              value={content}
              onChange={setContent}
              name={`kye_editor_${block.id}`}
              editorProps={{ $blockScrolling: true }}
              width="100%"
              height="100%"
              showPrintMargin={false}
              showGutter={false}
              highlightActiveLine={true}
              setOptions={{
                enableBasicAutocompletion: true,
                enableLiveAutocompletion: true,
                enableSnippets: true,
                showLineNumbers: false,
                tabSize: 2,
              }}
            />
          </div>
          <button 
            onClick={handleEditToggle}
            style={{ 
              position: 'absolute', 
              top: -30, 
              right: 10, 
              zIndex: 20,
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
        </>
      ) : renderer ? (
        <renderer.view id={block.id} markdown={content} metadata={metadata} />
      ) : (
        <div style={{ padding: '8px', color: '#ef4444', fontSize: '12px' }}>
          Unknown type: {block.shapes.join(', ')}
        </div>
      )}
    </div>
  );
});

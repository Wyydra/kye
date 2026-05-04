import { memo, useMemo, useState, useEffect, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';

import { Block } from '../../types/workspace';
import { registry } from './NodeRendererRegistry';
import { PropertyEditor } from '../editors/PropertyEditor';

interface KyeNodeContentProps {
  block: Block;
  isEditing: boolean;
  onEditToggle: () => void;
  content: string;
  setContent: (content: string) => void;
  metadata: Record<string, unknown>;
  onMetadataChange: (meta: Record<string, unknown>) => void;
}

export const KyeNodeContent = memo(function KyeNodeContent({ 
  block, 
  isEditing, 
  onEditToggle,
  content,
  setContent,
  metadata,
  onMetadataChange
}: KyeNodeContentProps) {
  const renderer = useMemo(() => registry.getRenderer(block?.shapes ?? []), [block?.shapes]);
  const primaryType = block?.shapes.find(s => s !== 'text') ?? block?.shapes[0] ?? 'text';

  if (!block) return null;

  return (
    <div 
      style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
      onDoubleClick={(e) => {
        if (!isEditing) {
          e.stopPropagation();
          onEditToggle();
        }
      }}
    >
      {isEditing ? (
        <>
          <PropertyEditor
            blockType={primaryType}
            metadata={metadata}
            onMetadataChange={onMetadataChange}
          />
          <div style={{ flex: 1, position: 'relative', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <CodeMirror
              value={content}
              height="100%"
              theme={oneDark}
              extensions={[
                markdown({ base: markdownLanguage, codeLanguages: languages }),
                EditorView.lineWrapping,
                EditorView.theme({
                  "&": { height: "100%" },
                  ".cm-scroller": { overflow: "auto" },
                  ".cm-content": { 
                    padding: "10px 0",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "13px"
                  },
                  "&.cm-focused": { outline: "none" }
                })
              ]}
              onChange={(value) => setContent(value)}
              basicSetup={{
                lineNumbers: false,
                foldGutter: false,
                highlightActiveLine: true,
                autocompletion: true,
              }}
            />
          </div>
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

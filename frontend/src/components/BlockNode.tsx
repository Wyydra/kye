import React, { useEffect, useRef } from 'react';
import type { Node } from '@antv/x6';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';

export interface BlockNodeData {
  markdown: string;
  metadata?: Record<string, any>;
  shapes: string[];
  isEditing: boolean;
  setEditing: (editing: boolean) => void;
  updateContent: (markdown: string, metadata: Record<string, any>) => void;
}

export const BlockNodeComponent = ({ node }: { node: Node }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Note: @antv/x6-react-shape injecte node, et lors de node.setData, le composant se re-rend.
  const data = (node.getData() || {}) as BlockNodeData;
  const { 
    isEditing = false, 
    markdown = '', 
    metadata = {}, 
    shapes = [], 
    setEditing, 
    updateContent 
  } = data;

  const nodeType = shapes.length > 0 && shapes[0] !== 'text' ? shapes[0] : 'Text';

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
    ],
    content: markdown,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      if (updateContent && isEditing) {
        // Obtenir le markdown mis à jour
        const currentMd = (editor.storage as any).markdown.getMarkdown();
        updateContent(currentMd, metadata);
      }
    },
  });

  // Sync du md s'il est mis à jour depuis le backend (si pas de focus)
  useEffect(() => {
    if (editor && !editor.isFocused) {
      if ((editor.storage as any).markdown.getMarkdown() !== markdown) {
         editor.commands.setContent(markdown);
      }
    }
  }, [markdown, editor]);

  // Sync de l'état d'édition
  useEffect(() => {
    if (editor && editor.isEditable !== isEditing) {
      editor.setEditable(isEditing);
      if (isEditing) {
        editor.commands.focus('end');
      }
    }
  }, [isEditing, editor]);

  // Auto-resize du Noeud AntV
  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        // On rajoute une légère marge pour ne pas couper l'ombre portée
        const targetHeight = Math.max(100, height); 
        const currentSize = node.size();
        if (Math.abs(currentSize.height - targetHeight) > 2) {
          node.resize(currentSize.width, targetHeight);
        }
      }
    });

    if (containerRef.current) {
        observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [node]);

  const stopEvent = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation();

  // Filtrage des propriétés techniques (id, etc) pour l'affichage des métadonnées
  const renderProps = Object.entries(metadata).filter(([k]) => !['id', 'position', 'size', 'title'].includes(k));

  return (
    <div 
      className={`block-node ${isEditing ? 'is-editing' : ''}`}
      onDoubleClick={() => {
        if (!isEditing && setEditing) setEditing(true);
      }}
      style={{
        width: '100%',
        minHeight: '100%',
      }}
    >
        <div 
          ref={containerRef} 
          className="block-node-inner" 
        >
           {/* Header */}
           <div className="block-header">
              <span className="block-badge">{nodeType}</span>
              {isEditing && (
                 <button 
                  className="btn-done" 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (setEditing) setEditing(false); 
                  }}
                 >
                    Done
                 </button>
              )}
           </div>

           {/* Metadata (si pas vide) */}
           {renderProps.length > 0 && (
             <div className="block-properties">
                {renderProps.map(([key, val]) => (
                   <div key={key} className="prop-row">
                      <span className="prop-key">{key}</span>
                      <span className="prop-value">
                        {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                      </span>
                   </div>
                ))}
             </div>
           )}

           {/* Editor / Markdown */}
           <div 
             className="block-content tiptap-wrapper"
             onMouseDown={isEditing ? stopEvent : undefined}
           >
             <EditorContent editor={editor} />
           </div>
        </div>
    </div>
  );
};

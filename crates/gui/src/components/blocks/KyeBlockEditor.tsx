import React, { useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { EditorView } from '@codemirror/view';
import { Block } from '../../types/workspace';
import { workspaceService } from '../../services/WorkspaceService';
import { PropertyEditor } from '../editors/PropertyEditor';
import { cn } from '../../lib/utils';

interface KyeBlockEditorProps {
  block: Block;
  anchor: { x: number, y: number, width: number, height: number };
  isPopup?: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * Atomic Sub-components for better maintainability
 */

const EditorHeader = ({ onSave, isPopup }: { onSave: () => void, isPopup?: boolean }) => (
  <div className={cn(
    "bg-muted/50 border-b flex justify-between items-center select-none shrink-0",
    isPopup ? "px-4 py-3" : "px-3 py-2"
  )}>
    <div className="flex items-center gap-3">
      <div className={cn("rounded-full bg-primary animate-pulse", isPopup ? "w-2.5 h-2.5" : "w-2 h-2")} />
      <span className={cn(
        "font-black text-foreground uppercase tracking-[0.2em]",
        isPopup ? "text-xs" : "text-[10px]"
      )}>
        {isPopup ? "Editing Block" : "Editor"}
      </span>
    </div>
    <button 
      onClick={onSave} 
      className={cn(
        "font-black text-primary hover:bg-primary/10 rounded-lg transition-all active:scale-95",
        isPopup ? "text-xs px-4 py-2" : "text-[10px] px-2 py-1"
      )}
    >
      {isPopup ? "SAVE CHANGES (ESC)" : "DONE"}
    </button>
  </div>
);

const EditorChrome = ({ 
  children, 
  onSave, 
  isPopup, 
  className, 
  style 
}: { 
  children: React.ReactNode, 
  onSave: () => void, 
  isPopup?: boolean, 
  className?: string, 
  style?: React.CSSProperties 
}) => (
  <div 
    className={cn(
      "border-2 border-primary overflow-hidden flex flex-col",
      isPopup ? "relative w-full max-w-3xl h-full max-h-[600px] rounded-xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200" : "absolute z-[200] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
      className
    )}
    style={{
      backgroundColor: '#ffffff',
      color: '#000000',
      border: '2px solid var(--primary)',
      ...style
    }}
  >
    <EditorHeader onSave={onSave} isPopup={isPopup} />
    {children}
  </div>
);

/**
 * Main Universal Editor Component
 */
export const KyeBlockEditor = ({ block, anchor, isPopup, onClose, onRefresh }: KyeBlockEditorProps) => {
  const [content, setContent] = useState(block.content);
  const [metadata, setMetadata] = useState(() => {
    try { return JSON.parse(block.metadata); } catch { return {}; }
  });

  const primaryType = useMemo(() => 
    block.shapes.find(s => s !== 'text') ?? block.shapes[0] ?? 'text'
  , [block.shapes]);

  const handleSave = useCallback(async () => {
    const metaStr = JSON.stringify(metadata);
    if (content !== block.content || metaStr !== block.metadata) {
      await workspaceService.updateBlock(block.id, content, metaStr);
      onRefresh();
    }
    onClose();
  }, [block.id, block.content, block.metadata, content, metadata, onRefresh, onClose]);

  // Global Keyboard Shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const cmExtensions = useMemo(() => [
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    EditorView.lineWrapping,
    EditorView.theme({
      "&": { height: "100%", backgroundColor: "transparent" },
      ".cm-content": { 
        padding: isPopup ? "24px" : "12px", 
        fontSize: isPopup ? "16px" : "14px", 
        lineHeight: isPopup ? "1.7" : "1.6" 
      },
      "&.cm-focused": { outline: "none" }
    })
  ], [isPopup]);

  const editor = (
    <EditorChrome 
      isPopup={isPopup} 
      onSave={handleSave}
      style={!isPopup ? {
        left: anchor.x,
        top: anchor.y,
        width: anchor.width,
        height: anchor.height,
      } : undefined}
    >
      <PropertyEditor
        blockType={primaryType}
        metadata={metadata}
        onMetadataChange={setMetadata}
      />

      <div className="flex-1 overflow-hidden">
        <CodeMirror
          value={content}
          height="100%"
          autoFocus
          extensions={cmExtensions}
          onChange={setContent}
        />
      </div>
    </EditorChrome>
  );

  if (isPopup) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-200">
        <div 
          className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
          onClick={handleSave} 
        />
        {editor}
      </div>,
      document.body
    );
  }

  return editor;
};

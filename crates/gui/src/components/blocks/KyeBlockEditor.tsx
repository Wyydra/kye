import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Block, TemplateDto } from '../../types/workspace';
import { workspaceService } from '../../services/WorkspaceService';
import { PropertyEditor } from '../editors/PropertyEditor';
import { EditorChrome } from './EditorChrome';

interface KyeBlockEditorProps {
  block: Block;
  anchor: { x: number; y: number; width: number; height: number };
  isPopup: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

/**
 * Universal Block Editor
 * A dumb wrapper that delegates editing to the PropertyEditor
 * based on the primary type provided by the backend.
 */
export const KyeBlockEditor = ({ block, anchor, isPopup, onClose, onRefresh }: KyeBlockEditorProps) => {
  // 1. Dumb State: Backend is the source of truth for all fields
  const [fields, setFields] = useState<Record<string, any>>(() => block.fields);

  const handleSave = useCallback(async () => {
    // We only update via a flat field map now
    await workspaceService.updateBlock(block.id, null, JSON.stringify(fields));
    onRefresh();
    onClose();
  }, [block.id, fields, onRefresh, onClose]);

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
      <div className="flex flex-col h-full bg-card">
        <div className="flex-1 overflow-auto flex flex-col">
          <PropertyEditor
            blockType={block.primary_shape}
            metadata={fields}
            onMetadataChange={setFields}
          />
        </div>
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

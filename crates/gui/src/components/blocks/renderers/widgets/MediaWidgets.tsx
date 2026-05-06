import React, { useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { widgetRegistry, resolveTemplate, resolveProp } from '../WidgetRegistry';
import { useWorkspacePath } from '../../../../context/WorkspaceContext';
import { workspaceService } from '../../../../services/WorkspaceService';

widgetRegistry.register('image', ({ blueprint, metadata }) => {
  const imageUrl = String(resolveProp(blueprint, metadata, 'value') || "");
  const workspacePath = useWorkspacePath();
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    if (imageUrl && workspacePath) {
        const fullPath = `${workspacePath}/${imageUrl}`;
        setSrc(convertFileSrc(fullPath));
    }
  }, [imageUrl, workspacePath]);

  return (
    <div className="w-full h-full overflow-hidden rounded-lg bg-secondary/20">
      {src ? (
        <img 
          src={src} 
          alt="Widget" 
          className="w-full h-full object-cover"
          draggable={false}
          onError={(e) => {
            (e.target as HTMLImageElement).src = ""; 
            (e.target as HTMLImageElement).className = "hidden";
          }}
        />
      ) : (
        <div className="text-xs opacity-30 italic">Image not found</div>
      )}
    </div>
  );
});

widgetRegistry.register('button', ({ blueprint, metadata, block, onRefresh }) => {
  const label = resolveTemplate(resolveProp(blueprint, metadata, 'label'), metadata);
  
  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const action = blueprint.actions['onClick'];
    if (!action) return;

    if (action.type === 'update_field') {
      const newMetadata = { ...metadata, [action.field]: action.value };
      await workspaceService.updateBlock(block.id, block.content, JSON.stringify(newMetadata));
      onRefresh();
    }
  };

  return (
    <button 
      className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold hover:bg-primary/90 transition-colors shadow-sm"
      onClick={handleClick}
    >
      {label || "Button"}
    </button>
  );
});

widgetRegistry.register('link', ({ blueprint, metadata, block }) => {
    const linkUrl = resolveProp(blueprint, metadata, 'value') || block.content;
    const linkLabel = resolveProp(blueprint, metadata, 'label') || linkUrl || "Link";
    
    return (
      <a 
        href={String(linkUrl || '#')} 
        target="_blank" 
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium text-sm flex items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <span>{String(linkLabel)}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
      </a>
    );
});

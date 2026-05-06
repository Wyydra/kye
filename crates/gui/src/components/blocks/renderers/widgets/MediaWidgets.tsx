import React, { useState, useEffect, useMemo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { ImageIcon, ExternalLink, RefreshCw } from 'lucide-react';
import { widgetRegistry, resolveTemplate, resolveProp } from '../WidgetRegistry';
import { useWorkspacePath } from '../../../../context/WorkspaceContext';
import { workspaceService } from '../../../../services/WorkspaceService';

widgetRegistry.register('image', ({ blueprint, metadata }) => {
  const imageUrl = String(resolveProp(blueprint, metadata, 'value') || "");
  const workspacePath = useWorkspacePath();
  const [src, setSrc] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageUrl) {
        setSrc("");
        return;
    }

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        setSrc(imageUrl);
        setError(false);
    } else if (workspacePath) {
        const fullPath = `${workspacePath}/${imageUrl}`;
        setSrc(convertFileSrc(fullPath));
        setError(false);
    }
  }, [imageUrl, workspacePath]);

  return (
    <div className="group relative w-full h-full overflow-hidden rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center transition-all hover:border-primary/30">
      {src && !error ? (
        <>
          <img 
            src={src} 
            alt="Widget content" 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            draggable={false}
            onError={() => setError(true)}
          />
          {/* Subtle overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 opacity-20 group-hover:opacity-40 transition-opacity">
          <ImageIcon className="h-8 w-8" />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {error ? "Image Load Failed" : "No Image Selected"}
          </span>
        </div>
      )}

      {/* Floating Info (Only if URL exists) */}
      {imageUrl && (
        <div className="absolute bottom-2 right-2 p-1.5 bg-black/40 backdrop-blur-md rounded-lg opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
           <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white">
             <ExternalLink className="h-3 w-3" />
           </a>
        </div>
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
      className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
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
        className="group/link text-primary hover:text-primary/80 font-bold text-sm flex items-center gap-2 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-1.5 rounded-lg bg-primary/10 group-hover/link:bg-primary/20 transition-colors">
          <LinkIcon className="h-3 w-3" />
        </div>
        <span className="underline-offset-4 group-hover/link:underline">{String(linkLabel)}</span>
      </a>
    );
});

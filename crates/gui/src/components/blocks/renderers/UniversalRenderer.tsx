import React, { useMemo, useCallback, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { convertFileSrc } from '@tauri-apps/api/core';
import { WidgetBlueprint, Block } from '../../../types/workspace';
import { cn } from '../../../lib/utils';
import { workspaceService } from '../../../services/WorkspaceService';
import { useWorkspacePath } from '../../../context/WorkspaceContext';

interface UniversalRendererProps {
  blueprint: WidgetBlueprint;
  block: Block;
  metadata: Record<string, any>;
  onRefresh: () => void;
}

export const UniversalRenderer: React.FC<UniversalRendererProps> = ({ 
  blueprint, 
  block, 
  metadata,
  onRefresh 
}) => {
  const handleAction = async (action?: any) => {
    if (!action) return;
    
    if (action.type === 'update_field') {
      const newMetadata = { ...metadata, [action.field]: action.value };
      await workspaceService.updateBlock(block.id, block.content, JSON.stringify(newMetadata));
      onRefresh();
    }
  };

  const renderWidget = (bp: WidgetBlueprint): React.ReactNode => {
    switch (bp.type) {
      case 'stack':
        return (
          <div className={cn(
            "flex gap-2 w-full",
            bp.direction === 'horizontal' ? "flex-row items-center" : "flex-col"
          )}>
            {bp.children?.map((child, i) => (
              <React.Fragment key={i}>{renderWidget(child)}</React.Fragment>
            ))}
          </div>
        );

      case 'grid':
        return (
          <div 
            className="grid gap-2 w-full" 
            style={{ gridTemplateColumns: `repeat(${bp.columns || 1}, minmax(0, 1fr))` }}
          >
            {bp.children?.map((child, i) => (
              <React.Fragment key={i}>{renderWidget(child)}</React.Fragment>
            ))}
          </div>
        );

      case 'text':
        let displayValue = bp.value || "";
        if (displayValue.includes('{{')) {
          displayValue = displayValue.replace(/\{\{(.+?)\}\}/g, (_, key) => {
            return String(metadata[key.trim()] || key);
          });
        }
        
        return (
          <span className={cn(
            "text-sm font-medium",
            bp.style === 'header' && "text-xs font-black uppercase tracking-widest opacity-50",
            !displayValue && "opacity-30 italic"
          )}>
            {displayValue || "Empty text"}
          </span>
        );

      case 'markdown':
        const mdContent = bp.bind ? metadata[bp.bind] : block.content;
        return (
          <div className="prose prose-sm dark:prose-invert max-w-none w-full">
            {mdContent ? (
                <ReactMarkdown>{String(mdContent)}</ReactMarkdown>
            ) : (
                <span className="opacity-30 italic text-xs">Empty (click to edit)</span>
            )}
          </div>
        );

      case 'image':
        return (
          <ImageWidget 
            imageUrl={bp.bind ? String(metadata[bp.bind] || "") : ""} 
          />
        );

      case 'link':
        const linkUrl = bp.bind ? metadata[bp.bind] : block.content;
        const linkLabel = bp.label || (bp.bind ? metadata[bp.bind] : "Link");
        return (
          <a 
            href={String(linkUrl || '#')} 
            target="_blank" 
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 text-primary hover:underline font-medium text-sm"
          >
            <span className="truncate">{String(linkLabel)}</span>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-0L10 14" />
            </svg>
          </a>
        );

      case 'button':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction(bp.onClick);
            }}
            className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold hover:opacity-90 active:scale-95 transition-all"
          >
            {bp.label}
          </button>
        );

      case 'flipCard':
        return <FlipCardWidget front={bp.front!} back={bp.back!} render={renderWidget} />;

      default:
        return <div className="text-red-500 text-[10px]">Unknown widget: {bp.type}</div>;
    }
  };

  return (
    <>
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
      <div className="w-full h-full flex flex-col">{renderWidget(blueprint)}</div>
    </>
  );
};

/**
 * Specialized Widgets
 */

const ImageWidget = ({ imageUrl }: { imageUrl: string }) => {
  const workspacePath = useWorkspacePath();
  
  const src = useMemo(() => {
    if (!imageUrl) return "";
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://') || imageUrl.startsWith('data:')) {
      return imageUrl;
    }

    if (workspacePath) {
      const sep = workspacePath.endsWith('/') || workspacePath.endsWith('\\') ? '' : (workspacePath.includes('\\') ? '\\' : '/');
      const cleanPath = imageUrl.startsWith('./') ? imageUrl.slice(2) : imageUrl;
      return convertFileSrc(`${workspacePath}${sep}${cleanPath}`);
    }

    return convertFileSrc(imageUrl);
  }, [imageUrl, workspacePath]);

  return (
    <div className="w-full h-full flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-[100px]">
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
};

const FlipCardWidget = ({ 
  front, 
  back, 
  render 
}: { 
  front: WidgetBlueprint, 
  back: WidgetBlueprint, 
  render: (bp: WidgetBlueprint) => React.ReactNode 
}) => {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <div 
      className="relative w-full min-h-[150px] cursor-pointer perspective-1000 group"
      onClick={(e) => {
          e.stopPropagation();
          setIsFlipped(!isFlipped);
      }}
    >
      <div className={cn(
        "relative w-full h-full transition-all duration-500 preserve-3d min-h-[150px]",
        isFlipped ? "rotate-y-180" : ""
      )}>
        <div className="absolute inset-0 backface-hidden bg-card border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm group-hover:border-primary/30 transition-colors">
          {render(front)}
        </div>
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-primary/5 border-2 border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-inner">
          {render(back)}
        </div>
      </div>
    </div>
  );
};

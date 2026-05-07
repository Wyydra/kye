import React from 'react';
import { cn } from '../../lib/utils';

interface EditorChromeProps {
  children: React.ReactNode;
  onSave: () => void;
  isPopup?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const EditorHeader = ({ onSave, isPopup }: { onSave: () => void, isPopup?: boolean }) => (
  <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
        Editing Block
      </span>
    </div>
    <div className="flex items-center gap-4">
      <button 
        onClick={onSave}
        className="text-[10px] font-black uppercase tracking-widest text-primary hover:text-primary/70 transition-colors"
      >
        Save Changes (ESC)
      </button>
    </div>
  </div>
);

export const EditorChrome = ({ 
  children, 
  onSave, 
  isPopup, 
  className, 
  style 
}: EditorChromeProps) => (
  <div 
    className={cn(
      "border-2 border-primary overflow-hidden flex flex-col bg-card",
      isPopup 
        ? "relative w-full max-w-3xl h-full max-h-[600px] rounded-xl shadow-[0_30px_100px_rgba(0,0,0,0.4)] animate-in zoom-in-95 duration-200" 
        : "absolute z-[200] rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.2)]",
      className
    )}
    style={{
      ...style
    }}
  >
    <EditorHeader onSave={onSave} isPopup={isPopup} />
    <div className="flex-1 overflow-hidden">
      {children}
    </div>
  </div>
);

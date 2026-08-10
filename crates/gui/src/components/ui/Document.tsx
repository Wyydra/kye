import React from "react";
import { cn } from "../../lib/utils";
import { Plus } from "lucide-react";

export const DocumentTitleInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => {
  return (
    <div className="pt-2 pb-4 mb-4 border-b border-border/30">
      <input
        type="text"
        placeholder="Untitled Document"
        className={cn(
          "w-full text-3xl md:text-4xl font-bold bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30 transition-colors",
          className
        )}
        {...props}
      />
    </div>
  );
};

export const DocumentEmptyPlaceholder: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "py-8 px-4 text-muted-foreground/60 hover:text-muted-foreground italic text-sm cursor-text border border-dashed border-border/40 hover:border-primary/50 rounded-xl transition-all duration-150 flex items-center justify-center gap-2 bg-muted/10 hover:bg-muted/20 my-2",
        className
      )}
      {...props}
    >
      <Plus className="w-4 h-4 text-muted-foreground/70" />
      <span>{children || "Empty document. Click to start writing..."}</span>
    </div>
  );
};

export const DocumentAddBlockZone: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div
      className={cn(
        "h-16 w-full cursor-text hover:bg-muted/10 rounded-lg transition-colors flex items-center px-3 opacity-0 hover:opacity-100 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      Click to add block...
    </div>
  );
};

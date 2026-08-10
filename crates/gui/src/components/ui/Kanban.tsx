import React from "react";
import { cn } from "../../lib/utils";

export const KanbanContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("flex gap-4 overflow-x-auto py-3 w-full", className)} {...props}>
      {children}
    </div>
  );
};

export const KanbanColumn: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "min-w-[260px] w-72 flex-shrink-0 bg-muted/20 border border-border/60 p-3 rounded-xl flex flex-col gap-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const KanbanHeader: React.FC<{ title: string; count?: number; className?: string }> = ({ title, count, className }) => {
  return (
    <div className={cn("flex items-center justify-between px-1", className)}>
      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
        {title}
      </h4>
      {count !== undefined && (
        <span className="text-xs text-muted-foreground/70 bg-muted px-2 py-0.5 rounded-full font-mono">
          {count}
        </span>
      )}
    </div>
  );
};

export const KanbanCard: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "bg-card border border-border/80 rounded-lg p-2.5 shadow-xs hover:border-primary/40 transition-colors",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

import React from "react";
import { cn } from "../../lib/utils";

export const ListContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("flex flex-col divide-y divide-border/40 border border-border/80 rounded-xl bg-background my-2 overflow-hidden shadow-xs", className)} {...props}>
      {children}
    </div>
  );
};

export const ListItem: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("p-3 hover:bg-muted/15 transition-colors duration-150", className)} {...props}>
      {children}
    </div>
  );
};

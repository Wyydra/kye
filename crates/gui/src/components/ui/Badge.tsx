import React from "react";
import { cn } from "../../lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "active" | "muted";
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", children, ...props }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-colors",
        variant === "default" && "bg-muted text-muted-foreground",
        variant === "active" && "bg-primary/15 text-primary border border-primary/30",
        variant === "muted" && "bg-muted/40 text-muted-foreground/70",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

import React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "active"
    | "muted"
    | "danger"
    | "warning"
    | "success"
    | "outline";
  size?: "xs" | "sm";
}

const variantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-muted text-muted-foreground",
  active: "bg-primary/15 text-primary border border-primary/25 font-semibold",
  muted: "bg-muted/40 text-muted-foreground/70",
  danger: "bg-destructive/15 text-destructive border border-destructive/25 font-semibold",
  warning: "bg-amber-500/15 text-amber-500 border border-amber-500/25 font-semibold",
  success: "bg-emerald-500/15 text-emerald-500 border border-emerald-500/25 font-semibold",
  outline: "bg-transparent text-foreground border border-border/80",
};

const sizeClasses: Record<NonNullable<BadgeProps["size"]>, string> = {
  xs: "text-[10px] px-1.5 py-0.2 rounded leading-none",
  sm: "text-xs px-2 py-0.5 rounded-full leading-tight font-medium",
};

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = "default",
  size = "sm",
  children,
  ...props
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 transition-colors select-none font-mono",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};

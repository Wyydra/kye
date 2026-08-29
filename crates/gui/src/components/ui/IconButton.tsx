import React from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "ghost" | "secondary" | "danger" | "primary";
  size?: "xs" | "sm" | "md";
  title?: string;
}

const variantClasses: Record<NonNullable<IconButtonProps["variant"]>, string> = {
  ghost:
    "text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/80",
  secondary:
    "bg-muted/40 text-foreground hover:bg-muted/70 border border-border/60",
  danger:
    "text-muted-foreground hover:text-destructive hover:bg-destructive/15",
  primary:
    "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20",
};

const sizeClasses: Record<NonNullable<IconButtonProps["size"]>, string> = {
  xs: "p-1 rounded-md text-xs",
  sm: "p-1.5 rounded-lg text-sm",
  md: "p-2 rounded-lg text-base",
};

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      className,
      variant = "ghost",
      size = "sm",
      title,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        title={title}
        aria-label={title}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center transition-colors cursor-pointer select-none shrink-0",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

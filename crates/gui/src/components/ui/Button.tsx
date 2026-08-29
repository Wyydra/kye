import React from "react";
import { cn } from "../../lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "xs" | "sm" | "md";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-primary text-primary-foreground hover:opacity-90 active:opacity-95 shadow-xs",
  secondary:
    "bg-muted/40 hover:bg-muted/70 text-foreground border border-border/60",
  outline:
    "bg-transparent hover:bg-muted/30 text-foreground border border-border/80 focus:border-primary",
  ghost:
    "bg-transparent hover:bg-muted/40 text-foreground/90 hover:text-foreground",
  danger:
    "bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  xs: "px-2 py-1 text-[11px] rounded-md gap-1",
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5 font-medium",
  md: "px-4 py-2 text-sm rounded-lg gap-2 font-medium",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "sm",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-sans transition-all duration-150 cursor-pointer select-none",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        ) : (
          leftIcon && <span className="shrink-0">{leftIcon}</span>
        )}
        {children && <span>{children}</span>}
        {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

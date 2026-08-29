import React from "react";
import { cn } from "../../lib/utils";

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "xs" | "sm" | "md" | "lg";
  variant?: "primary" | "muted" | "white";
  label?: React.ReactNode;
}

const sizeClasses: Record<NonNullable<SpinnerProps["size"]>, string> = {
  xs: "w-3.5 h-3.5 border",
  sm: "w-5 h-5 border-2",
  md: "w-7 h-7 border-2",
  lg: "w-10 h-10 border-3",
};

const variantClasses: Record<NonNullable<SpinnerProps["variant"]>, string> = {
  primary: "border-primary border-t-transparent",
  muted: "border-muted-foreground/30 border-t-muted-foreground",
  white: "border-white/30 border-t-white",
};

export const Spinner: React.FC<SpinnerProps> = ({
  size = "sm",
  variant = "primary",
  label,
  className,
  ...props
}) => {
  return (
    <div className={cn("inline-flex items-center gap-2 font-sans select-none", className)} {...props}>
      <div
        className={cn(
          "rounded-full animate-spin shrink-0",
          sizeClasses[size],
          variantClasses[variant]
        )}
      />
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
};

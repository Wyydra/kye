import React from "react";
import { cn } from "../../lib/utils";

export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  bordered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  bordered = true,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-xl font-sans select-none",
        bordered && "border border-dashed border-border/70 bg-muted/5",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="mb-3 text-muted-foreground/60 flex items-center justify-center">
          {icon}
        </div>
      )}

      {title && (
        <h4 className="text-xs font-semibold text-foreground tracking-tight mb-1">
          {title}
        </h4>
      )}

      {description && (
        <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
          {description}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};

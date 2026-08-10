import React from "react";
import { cn } from "../../lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export const Card: React.FC<CardProps> = ({ className, interactive, children, ...props }) => {
  return (
    <div
      className={cn(
        "border border-border/70 rounded-xl p-4 bg-card shadow-xs transition-all duration-200",
        interactive && "hover:shadow-md hover:border-primary/40 cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("flex items-center justify-between pb-2 mb-2 border-b border-border/40", className)} {...props}>
      {children}
    </div>
  );
};

export const CardBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("text-sm text-foreground", className)} {...props}>
      {children}
    </div>
  );
};

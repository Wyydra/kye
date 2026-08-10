import React from "react";
import { cn } from "../../lib/utils";

export const ModalOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed inset-0 z-[200] flex items-center justify-center bg-background/60 backdrop-blur-md animate-in fade-in duration-200",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ModalOverlay.displayName = "ModalOverlay";

export const ModalContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "relative w-full md:max-w-4xl h-full md:h-[85vh] bg-background border-none md:border md:border-border/80 shadow-2xl md:rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const ModalHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("flex items-center justify-between p-3.5 border-b border-border/60 bg-muted/20", className)} {...props}>
      {children}
    </div>
  );
};

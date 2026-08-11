import React, { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: "max-w-sm h-auto",
  md: "max-w-md h-auto",
  lg: "max-w-2xl h-auto md:h-[80vh]",
  xl: "max-w-4xl h-full md:h-[85vh]",
  full: "max-w-[95vw] h-[95vh]",
};

export const ModalOverlay = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center p-4 bg-background/60 backdrop-blur-md animate-in fade-in duration-200 select-none",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
ModalOverlay.displayName = "ModalOverlay";

export const ModalContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "relative w-full bg-background border border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
ModalContent.displayName = "ModalContent";

export const ModalHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 py-4 border-b border-border/60 bg-muted/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const ModalTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <h3
      className={cn(
        "text-sm font-mono font-bold tracking-tight text-foreground flex items-center gap-2",
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
};

export const ModalDescription: React.FC<
  React.HTMLAttributes<HTMLParagraphElement>
> = ({ className, children, ...props }) => {
  return (
    <p
      className={cn("text-xs text-muted-foreground font-mono mt-0.5", className)}
      {...props}
    >
      {children}
    </p>
  );
};

export const ModalBody: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn("flex-1 overflow-y-auto p-5 font-mono", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const ModalFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-2 px-5 py-3.5 border-t border-border/60 bg-muted/20",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

/**
 * Reusable, accessible, and clean Modal component.
 * Rendered at body root via React Portal to prevent container clipping.
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (closeOnEscape && e.key === "Escape") {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const content = (
    <ModalOverlay
      ref={overlayRef}
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === overlayRef.current) {
          onClose();
        }
      }}
    >
      <ModalContent className={cn(sizeClasses[size], className)}>
        {(title || description) && (
          <ModalHeader>
            <div>
              {typeof title === "string" ? <ModalTitle>{title}</ModalTitle> : title}
              {typeof description === "string" ? (
                <ModalDescription>{description}</ModalDescription>
              ) : (
                description
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </ModalHeader>
        )}

        <ModalBody>{children}</ModalBody>

        {footer && <ModalFooter>{footer}</ModalFooter>}
      </ModalContent>
    </ModalOverlay>
  );

  return createPortal(content, document.body);
};

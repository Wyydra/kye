import React from "react";
import { cn } from "../../lib/utils";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  description?: React.ReactNode;
  error?: React.ReactNode;
  required?: boolean;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  description,
  error,
  required,
  className,
  children,
  ...props
}) => {
  return (
    <div className={cn("flex flex-col gap-1.5 w-full text-xs font-sans", className)} {...props}>
      {label && (
        <label className="text-xs font-medium text-foreground flex items-center gap-1">
          <span>{label}</span>
          {required && <span className="text-destructive">*</span>}
        </label>
      )}

      {description && (
        <p className="text-[11px] text-muted-foreground leading-tight -mt-0.5">{description}</p>
      )}

      {children}

      {error && (
        <p className="text-[11px] text-destructive leading-tight font-medium animate-in fade-in-50 duration-100">
          {error}
        </p>
      )}
    </div>
  );
};

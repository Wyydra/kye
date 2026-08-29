import React from "react";
import { cn } from "../../lib/utils";
import { Search, X } from "lucide-react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "xs" | "sm" | "md";
  error?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const inputSizeClasses: Record<NonNullable<InputProps["inputSize"]>, string> = {
  xs: "px-2.5 py-1 text-xs rounded-md",
  sm: "px-3 py-1.5 text-xs rounded-lg",
  md: "px-3.5 py-2 text-sm rounded-lg",
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      inputSize = "sm",
      error = false,
      leftIcon,
      rightIcon,
      type = "text",
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="relative flex items-center w-full">
        {leftIcon && (
          <div className="absolute left-2.5 pointer-events-none text-muted-foreground flex items-center shrink-0">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={type}
          disabled={disabled}
          className={cn(
            "w-full bg-muted/20 border border-border/80 focus:border-primary text-foreground placeholder:text-muted-foreground/60 transition-colors outline-none font-sans",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-destructive focus:border-destructive",
            inputSizeClasses[inputSize],
            leftIcon && "pl-8",
            rightIcon && "pr-8",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-2.5 text-muted-foreground flex items-center shrink-0">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export interface SearchInputProps
  extends Omit<InputProps, "leftIcon" | "rightIcon" | "type"> {
  onClear?: () => void;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, placeholder = "Search...", className, ...props }, ref) => {
    const hasValue = Boolean(value);

    return (
      <Input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        leftIcon={<Search className="w-3.5 h-3.5" />}
        rightIcon={
          hasValue && onClear ? (
            <button
              type="button"
              onClick={onClear}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : undefined
        }
        className={className}
        {...props}
      />
    );
  }
);

SearchInput.displayName = "SearchInput";

import React from "react";
import { cn } from "../../lib/utils";

type GapSize = "none" | "xs" | "sm" | "md" | "lg";
type AlignType = "start" | "center" | "end" | "stretch";
type PaddingSize = "none" | "xs" | "sm" | "md" | "lg";

const gapMap: Record<GapSize, string> = {
  none: "gap-0",
  xs: "gap-1",
  sm: "gap-2",
  md: "gap-4",
  lg: "gap-6",
};

const alignMap: Record<AlignType, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const paddingMap: Record<PaddingSize, string> = {
  none: "p-0",
  xs: "p-1.5",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: GapSize;
  align?: AlignType;
}

export const VStack: React.FC<StackProps> = ({
  gap = "sm",
  align = "stretch",
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn("flex flex-col w-full", gapMap[gap], alignMap[align], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface HStackProps extends StackProps {
  wrap?: boolean;
}

export const HStack: React.FC<HStackProps> = ({
  gap = "sm",
  align = "center",
  wrap = false,
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-row w-full",
        gapMap[gap],
        alignMap[align],
        wrap && "flex-wrap",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export interface GridColsProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: number;
  gap?: GapSize;
}

export const GridCols: React.FC<GridColsProps> = ({
  cols = 2,
  gap = "md",
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn("grid w-full", gapMap[gap], className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface BoxProps extends React.HTMLAttributes<HTMLDivElement> {
  p?: PaddingSize;
  bg?: "none" | "card" | "muted";
  border?: boolean;
  rounded?: "none" | "md" | "lg" | "xl";
}

export const Box: React.FC<BoxProps> = ({
  p = "none",
  bg = "none",
  border = false,
  rounded = "none",
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        paddingMap[p],
        bg === "card" && "bg-card",
        bg === "muted" && "bg-muted/20",
        border && "border border-border/70",
        rounded === "md" && "rounded-md",
        rounded === "lg" && "rounded-lg",
        rounded === "xl" && "rounded-xl",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

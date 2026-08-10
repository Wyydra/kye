import React from "react";
import { cn } from "../../lib/utils";

export const TableContainer: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, children, ...props }) => {
  return (
    <div className={cn("overflow-x-auto my-2 border border-border/80 rounded-xl bg-background shadow-xs", className)} {...props}>
      {children}
    </div>
  );
};

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement>> = ({ className, children, ...props }) => {
  return (
    <table className={cn("w-full text-sm border-collapse", className)} {...props}>
      {children}
    </table>
  );
};

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => {
  return (
    <thead className={cn("border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider", className)} {...props}>
      {children}
    </thead>
  );
};

export const TableRow: React.FC<React.HTMLAttributes<HTMLTableRowElement>> = ({ className, children, ...props }) => {
  return (
    <tr className={cn("border-b border-border/40 hover:bg-muted/15 transition-colors duration-150", className)} {...props}>
      {children}
    </tr>
  );
};

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => {
  return (
    <th className={cn("p-3 border-r border-border/60 text-left font-semibold", className)} {...props}>
      {children}
    </th>
  );
};

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({ className, children, ...props }) => {
  return <tbody className={cn("divide-y divide-border/30", className)} {...props}>{children}</tbody>;
};

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className, children, ...props }) => {
  return (
    <td className={cn("p-3 border-r border-border/40 text-xs text-foreground/90", className)} {...props}>
      {children}
    </td>
  );
};

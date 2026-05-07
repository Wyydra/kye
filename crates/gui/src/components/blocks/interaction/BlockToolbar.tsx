import React from 'react';
import { Pencil, Trash2, Copy, MoreHorizontal, LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface BlockToolbarProps {
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}

const ActionButton = ({ icon: Icon, onClick, className, destructive }: { 
  icon: LucideIcon, 
  onClick?: () => void, 
  className?: string,
  destructive?: boolean 
}) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    className={cn(
      "p-1.5 rounded-md transition-all duration-200",
      "hover:bg-primary/10 hover:text-primary text-foreground/60",
      destructive && "hover:text-destructive hover:bg-destructive/10",
      "active:scale-95",
      className
    )}
  >
    <Icon size={14} />
  </button>
);

export const BlockToolbar = ({ onEdit, onDelete, onCopy }: BlockToolbarProps) => {
  return (
    <div 
      className={cn(
        "absolute -top-12 left-1/2 -translate-x-1/2 pointer-events-auto",
        "flex items-center gap-1 p-1 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-xl",
        "animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300"
      )}
    >
      <ActionButton icon={Pencil} onClick={onEdit} />
      <ActionButton icon={Copy} onClick={onCopy} />
      <div className="w-[1px] h-4 bg-border mx-1" />
      <ActionButton icon={Trash2} onClick={onDelete} destructive />
      <ActionButton icon={MoreHorizontal} />
    </div>
  );
};

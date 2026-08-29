import React from "react";
import { Trash2, Copy, Edit3, Lock, Unlock } from "lucide-react";

interface BlockToolbarProps {
  onDelete: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onToggleLock?: () => void;
  isLocked?: boolean;
}

export const BlockToolbar: React.FC<BlockToolbarProps> = ({
  onDelete,
  onDuplicate,
  onEdit,
  onToggleLock,
  isLocked,
}) => {
  return (
    <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center gap-0.5 p-1 bg-card/95 backdrop-blur-md border border-border/80 shadow-xl rounded-xl pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-150 text-xs font-sans select-none z-50">
      {onEdit && (
        <ToolbarButton
          icon={<Edit3 className="w-3.5 h-3.5" />}
          label="Edit in Document View"
          onClick={onEdit}
        />
      )}

      {onToggleLock && (
        <ToolbarButton
          icon={isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
          label={isLocked ? "Unlock Block" : "Lock Block Position"}
          onClick={onToggleLock}
          className={isLocked ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20" : ""}
        />
      )}

      {onDuplicate && (
        <ToolbarButton
          icon={<Copy className="w-3.5 h-3.5" />}
          label="Duplicate Block"
          onClick={onDuplicate}
        />
      )}

      <div className="w-[1px] h-3.5 bg-border/60 mx-0.5" />

      <ToolbarButton
        icon={<Trash2 className="w-3.5 h-3.5" />}
        label="Delete Block"
        className="hover:text-destructive hover:bg-destructive/15"
        onClick={onDelete}
      />
    </div>
  );
};

const ToolbarButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}> = ({ icon, label, onClick, className }) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`p-1.5 rounded-lg hover:bg-muted/70 transition-colors flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer ${className || ""}`}
    title={label}
  >
    {icon}
  </button>
);

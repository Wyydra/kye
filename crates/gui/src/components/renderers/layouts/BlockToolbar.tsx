import { Trash2, Copy, Edit3, MoreHorizontal, Lock, Unlock } from 'lucide-react';

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
  isLocked 
}) => {
  return (
    <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 bg-background border border-border shadow-xl rounded-lg pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
      <ToolbarButton 
        icon={<Edit3 className="w-3.5 h-3.5" />} 
        label="Edit"
        onClick={onEdit || (() => {})} 
      />
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton 
        icon={isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />} 
        label={isLocked ? "Unlock" : "Lock"}
        onClick={onToggleLock || (() => {})}
        className={isLocked ? "text-primary bg-primary/10 hover:bg-primary/20" : ""}
      />
      <ToolbarButton 
        icon={<Copy className="w-3.5 h-3.5" />} 
        label="Duplicate"
        onClick={onDuplicate || (() => {})} 
      />
      <ToolbarButton 
        icon={<Trash2 className="w-3.5 h-3.5" />} 
        label="Delete"
        className="hover:text-destructive hover:bg-destructive/10"
        onClick={onDelete} 
      />
      <div className="w-px h-4 bg-border mx-1" />
      <ToolbarButton 
        icon={<MoreHorizontal className="w-3.5 h-3.5" />} 
        label="More"
        onClick={() => {}} 
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
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`p-1.5 rounded-md hover:bg-muted transition-colors flex items-center gap-1.5 text-muted-foreground hover:text-foreground ${className}`}
    title={label}
  >
    {icon}
  </button>
);

import React from "react";
import { Pin, PinOff, Folder, Trash2, Check } from "lucide-react";
import { Badge } from "../ui/Badge";
import { IconButton } from "../ui/IconButton";
import { cn } from "../../lib/utils";
import { RecentWorkspace } from "../../types/appLifecycle";

export const formatRelativeTime = (timestampMs: number): string => {
  const diff = Date.now() - timestampMs;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(timestampMs).toLocaleDateString();
};

export const getWorkspaceDisplayName = (ws: { name?: string; path: string }): string => {
  if (ws.name && ws.name.trim() && ws.name.trim() !== "Workspace") {
    return ws.name.trim();
  }
  const parts = ws.path.split(/[\/\\]/).filter(Boolean);
  const last = parts[parts.length - 1] || "";
  const stem = last.replace(/\.kye$/, "");
  if (stem.toLowerCase() === "workspace" && parts.length > 1) {
    return parts[parts.length - 2] || "Workspace";
  }
  return stem || "Workspace";
};

export interface WorkspaceItemProps {
  workspace: RecentWorkspace;
  isCurrent?: boolean;
  isSelected?: boolean;
  onSelect: (path: string) => void;
  onTogglePin?: (path: string) => void;
  onReveal?: (path: string) => void;
  onRemove?: (path: string) => void;
  onMouseEnter?: () => void;
}

export const WorkspaceItem: React.FC<WorkspaceItemProps> = ({
  workspace,
  isCurrent = false,
  isSelected = false,
  onSelect,
  onTogglePin,
  onReveal,
  onRemove,
  onMouseEnter,
}) => {
  const displayName = getWorkspaceDisplayName(workspace);

  return (
    <div
      onClick={() => onSelect(workspace.path)}
      onMouseEnter={onMouseEnter}
      className={cn(
        "group flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer select-none font-sans",
        isSelected
          ? "bg-primary/10 text-foreground"
          : "hover:bg-muted/30 text-foreground/90"
      )}
    >
      {/* Left Column: Title, Badges, Path */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition-colors">
            {displayName}
          </span>
          {isCurrent && (
            <Badge variant="active" size="xs">
              Active
            </Badge>
          )}
          {workspace.isPinned && (
            <Pin className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
          )}
          {!workspace.exists && (
            <Badge variant="danger" size="xs">
              Missing
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">
          {workspace.path}
        </span>
      </div>

      {/* Right Column: Time, Actions, Checkmark */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">
          {formatRelativeTime(workspace.lastOpened)}
        </span>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onTogglePin && (
            <IconButton
              size="xs"
              variant={workspace.isPinned ? "secondary" : "ghost"}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin(workspace.path);
              }}
              title={workspace.isPinned ? "Unpin workspace" : "Pin workspace"}
              className={workspace.isPinned ? "text-amber-400 opacity-100" : ""}
            >
              {workspace.isPinned ? (
                <Pin className="w-3.5 h-3.5 fill-amber-400" />
              ) : (
                <PinOff className="w-3.5 h-3.5" />
              )}
            </IconButton>
          )}

          {onReveal && (
            <IconButton
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onReveal(workspace.path);
              }}
              title="Reveal in file manager"
            >
              <Folder className="w-3.5 h-3.5" />
            </IconButton>
          )}

          {onRemove && (
            <IconButton
              size="xs"
              variant="danger"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(workspace.path);
              }}
              title="Remove from recents"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          )}
        </div>

        {isCurrent && <Check className="w-4 h-4 text-primary shrink-0" />}
      </div>
    </div>
  );
};

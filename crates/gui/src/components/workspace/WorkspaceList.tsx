import React, { useState, useMemo } from "react";
import { SearchInput } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { WorkspaceItem, getWorkspaceDisplayName } from "./WorkspaceItem";
import { RecentWorkspace } from "../../types/appLifecycle";
import { Folder } from "lucide-react";

export interface WorkspaceListProps {
  workspaces: RecentWorkspace[];
  currentPath?: string | null;
  selectedIndex?: number;
  onSelectedIndexChange?: (index: number) => void;
  onSelect: (path: string) => void;
  onTogglePin?: (path: string) => void;
  onReveal?: (path: string) => void;
  onRemove?: (path: string) => void;
  emptyAction?: React.ReactNode;
  showSearch?: boolean;
  searchPlaceholder?: string;
  maxHeightClass?: string;
  autoFocusSearch?: boolean;
}

export const WorkspaceList: React.FC<WorkspaceListProps> = ({
  workspaces,
  currentPath = null,
  selectedIndex,
  onSelectedIndexChange,
  onSelect,
  onTogglePin,
  onReveal,
  onRemove,
  emptyAction,
  showSearch = true,
  searchPlaceholder = "Search workspaces...",
  maxHeightClass = "max-h-72",
  autoFocusSearch = false,
}) => {
  const [search, setSearch] = useState("");

  const filteredWorkspaces = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter((w) => {
      const displayName = getWorkspaceDisplayName(w).toLowerCase();
      return displayName.includes(q) || w.path.toLowerCase().includes(q);
    });
  }, [workspaces, search]);

  return (
    <div className="space-y-3 w-full font-sans">
      {/* Search Header */}
      {showSearch && (workspaces.length > 3 || search) && (
        <SearchInput
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            onSelectedIndexChange?.(0);
          }}
          onClear={() => {
            setSearch("");
            onSelectedIndexChange?.(0);
          }}
          placeholder={searchPlaceholder}
          autoFocus={autoFocusSearch}
        />
      )}

      {/* List / Empty State */}
      {workspaces.length === 0 ? (
        <EmptyState
          icon={<Folder className="w-8 h-8 stroke-1" />}
          title="No recent workspaces"
          description="Create a new workspace or open an existing database file to get started."
          action={emptyAction}
        />
      ) : filteredWorkspaces.length === 0 ? (
        <EmptyState
          title="No workspaces match your search"
          description="Try typing a different name or path filter."
          bordered={false}
          className="py-6"
        />
      ) : (
        <div className={`overflow-y-auto space-y-0.5 pr-1 custom-scrollbar ${maxHeightClass}`}>
          {filteredWorkspaces.map((ws, idx) => (
            <WorkspaceItem
              key={ws.path}
              workspace={ws}
              isCurrent={ws.path === currentPath}
              isSelected={selectedIndex === idx}
              onSelect={onSelect}
              onTogglePin={onTogglePin}
              onReveal={onReveal}
              onRemove={onRemove}
              onMouseEnter={() => onSelectedIndexChange?.(idx)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

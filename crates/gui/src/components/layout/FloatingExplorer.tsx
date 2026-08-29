import React, { useState, useMemo, useRef, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { extractTextFromValue, val } from "../../types/domain";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { execute } from "../../lib/commands";
import { createChildNode } from "../../lib/nodeFactory";
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  FolderSync,
  Layers,
  X,
} from "lucide-react";
import { SearchInput } from "../ui/Input";
import { EmptyState } from "../ui/EmptyState";
import { KindList } from "../kinds/KindList";
import { KindIcon } from "../kinds/KindIcon";
import { BlockContextMenu } from "../ui/BlockContextMenu";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

/* --- Single Item in the Floating Explorer Tree --- */

interface ExplorerTreeItemProps {
  nodeId: string;
  depth?: number;
  onSelectNode: (nodeId: string) => void;
}

const ExplorerTreeItem: React.FC<ExplorerTreeItemProps> = ({
  nodeId,
  depth = 0,
  onSelectNode,
}) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const kinds = useGraphStore((state) => state.kinds);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  if (!node) return null;

  const titleText = extractTextFromValue(node.props.title);
  const bodyText = extractTextFromValue(node.props.body);
  const title =
    titleText ||
    (bodyText ? bodyText.slice(0, 30) : "") ||
    "Untitled";

  const [editTitle, setEditTitle] = useState(title);

  useEffect(() => {
    setEditTitle(title);
  }, [title]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  const handleCommitRename = () => {
    setIsRenaming(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== title) {
      execute({
        type: "set_prop",
        node_id: nodeId,
        key: "title",
        value: { t: "Text", v: trimmed },
      });
    } else {
      setEditTitle(title);
    }
  };

  const isSelected = selectedNodeId === nodeId;
  const hasChildren = node.children && node.children.length > 0;
  const kindDef = kinds[node.kind];

  const handleCreateChild = (childKind: string) => {
    setShowAddMenu(false);
    createChildNode(nodeId, childKind);
    setIsExpanded(true);
  };

  return (
    <div className="flex flex-col select-none relative group/item">
      {/* Indent Guide */}
      {depth > 0 && (
        <div
          className="absolute top-0 bottom-0 border-l border-border/30 pointer-events-none"
          style={{ left: `${depth * 0.75}rem` }}
        />
      )}

      {/* Row */}
      <div
        onClick={() => onSelectNode(nodeId)}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setContextMenuPos({ x: e.clientX, y: e.clientY });
        }}
        style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-1.5 rounded-lg text-xs font-sans cursor-pointer transition-colors duration-100 relative group min-h-[28px]",
          isSelected
            ? "bg-primary/15 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        {/* Expand / Collapse Chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="w-3.5 h-3.5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground transition-transform cursor-pointer"
          >
            <ChevronRight
              className={cn(
                "w-3 h-3 transition-transform duration-150 stroke-[2]",
                isExpanded && "rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-3.5 h-3.5 shrink-0" />
        )}

        {/* Dynamic Vector Icon */}
        <KindIcon
          kind={node.kind}
          kindDef={kindDef}
          size={13}
          className={cn(
            "transition-colors",
            isSelected ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"
          )}
        />

        {/* Title or Inline Edit Input */}
        {isRenaming ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleCommitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCommitRename();
              } else if (e.key === "Escape") {
                setIsRenaming(false);
                setEditTitle(title);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="flex-1 bg-background border border-primary/60 rounded px-1.5 py-0.5 text-xs text-foreground font-sans focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsRenaming(true);
            }}
            className="truncate flex-1 text-xs select-none leading-normal py-0.5"
            title="Double-click to rename"
          >
            {title}
          </span>
        )}

        {/* Hover Quick Actions */}
        {!isRenaming && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity ml-auto">
            {/* Quick Add Sub-Block */}
            <div className="relative" ref={addMenuRef}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAddMenu(!showAddMenu);
                }}
                className="p-0.5 hover:text-foreground hover:bg-muted/60 rounded transition-colors cursor-pointer text-muted-foreground"
                title="Add child block"
              >
                <Plus className="w-3 h-3" />
              </button>

              {showAddMenu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-6 z-50 w-48 bg-card border border-border/70 shadow-xl rounded-xl p-1.5 text-xs animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/40 mb-1">
                    Add Child Block
                  </div>
                  <KindList
                    kinds={kinds}
                    onSelect={handleCreateChild}
                    maxHeightClass="max-h-48"
                  />
                </div>
              )}
            </div>

            {/* Context Menu Trigger */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setContextMenuPos({ x: rect.right, y: rect.bottom });
              }}
              className="p-0.5 hover:text-foreground hover:bg-muted/60 rounded transition-colors cursor-pointer text-muted-foreground"
              title="More options"
            >
              <MoreHorizontal className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Children Tree */}
      {hasChildren && isExpanded && (
        <div className="flex flex-col">
          {node.children.map((childId) => (
            <ExplorerTreeItem
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              onSelectNode={onSelectNode}
            />
          ))}
        </div>
      )}

      {/* Universal Context Menu */}
      <BlockContextMenu
        isOpen={!!contextMenuPos}
        x={contextMenuPos?.x ?? 0}
        y={contextMenuPos?.y ?? 0}
        nodeId={nodeId}
        onClose={() => setContextMenuPos(null)}
        onStartRename={() => setIsRenaming(true)}
      />
    </div>
  );
};

/* --- Main Floating Explorer Popover --- */

interface FloatingExplorerProps {
  isOpen: boolean;
  onClose: () => void;
  autoFocusSearch?: boolean;
}

export const FloatingExplorer: React.FC<FloatingExplorerProps> = ({
  isOpen,
  onClose,
  autoFocusSearch = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);
  const kinds = useGraphStore((state) => state.kinds);

  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);
  const openBuffer = useUIStore((state) => state.openBuffer);
  const openBufferIds = useUIStore((state) => state.openBufferIds);
  const closeBuffer = useUIStore((state) => state.closeBuffer);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);
  const setWorkspaceSwitcherOpen = useUIStore((state) => state.setWorkspaceSwitcherOpen);
  const setTypeManagerOpen = useUIStore((state) => state.setTypeManagerOpen);

  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Dynamic Query Filter
  const displayedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roots;

    let targetKind: string | null = null;
    let textQuery = q;

    if (q.startsWith("is:")) {
      const parts = q.split(" ");
      const isPart = parts[0].replace("is:", "");
      textQuery = parts.slice(1).join(" ").trim();
      const matchKind = Object.keys(kinds).find(
        (k) => k.toLowerCase().includes(isPart) || kinds[k]?.label.toLowerCase().includes(isPart)
      );
      if (matchKind) targetKind = matchKind;
    }

    return Object.values(nodes)
      .filter((node) => {
        if (targetKind && node.kind !== targetKind) return false;
        if (!textQuery) return true;

        const title = extractTextFromValue(node.props.title).toLowerCase();
        const body = extractTextFromValue(node.props.body).toLowerCase();
        return title.includes(textQuery) || body.includes(textQuery);
      })
      .map((n) => n.id);
  }, [roots, nodes, kinds, searchQuery]);

  if (!isOpen) return null;

  const handleSelectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    openBuffer(nodeId);
    setActiveViewMode("editor");
    onClose();
  };

  const handleOpenWorkspaceSwitcher = () => {
    onClose();
    setWorkspaceSwitcherOpen(true);
  };

  const handleOpenTypeManager = () => {
    onClose();
    setTypeManagerOpen(true);
  };

  return (
    <div
      ref={containerRef}
      className="absolute top-14 left-0 w-84 max-h-[500px] bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-2.5 flex flex-col font-sans select-none z-50 animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Search Header */}
      <div className="pb-2 border-b border-border/40">
        <SearchInput
          inputSize="xs"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onClear={() => setSearchQuery("")}
          placeholder="Search notes, is:task..."
          autoFocus={autoFocusSearch}
        />
      </div>

      {/* Open Tabs Quick Switcher */}
      {!searchQuery && openBufferIds.length > 0 && (
        <div className="py-2 border-b border-border/40">
          <div className="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">
            Open Tabs
          </div>
          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto custom-scrollbar">
            {openBufferIds.map((id) => {
              const node = nodes[id];
              const title = node ? val<string>(node.props.title) || "Untitled" : "Closed";
              const isActive = selectedNodeId === id;

              return (
                <div
                  key={id}
                  onClick={() => handleSelectNode(id)}
                  className={cn(
                    "group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-colors",
                    isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  )}
                >
                  <span className="truncate max-w-[140px] leading-normal">{title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeBuffer(id);
                    }}
                    className="p-0.5 text-muted-foreground hover:text-foreground rounded transition-colors cursor-pointer"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto py-1.5 custom-scrollbar max-h-64">
        <div className="flex flex-col gap-0.5">
          {displayedNodeIds.length === 0 ? (
            <EmptyState
              title={searchQuery ? "No matching blocks" : "No blocks"}
              description={searchQuery ? undefined : "Create your first block using the + button."}
              bordered={false}
              className="py-6 text-xs"
            />
          ) : (
            displayedNodeIds.map((id) => (
              <ExplorerTreeItem
                key={id}
                nodeId={id}
                depth={0}
                onSelectNode={handleSelectNode}
              />
            ))
          )}
        </div>
      </div>

      {/* Bottom Actions Footer */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
        <Button
          variant="ghost"
          size="xs"
          leftIcon={<FolderSync className="w-3.5 h-3.5 text-primary" />}
          onClick={handleOpenWorkspaceSwitcher}
          className="text-xs font-normal"
        >
          Switch Workspace...
        </Button>

        <Button
          variant="ghost"
          size="xs"
          leftIcon={<Layers className="w-3.5 h-3.5" />}
          onClick={handleOpenTypeManager}
          className="text-xs font-normal"
        >
          Schemas
        </Button>
      </div>
    </div>
  );
};

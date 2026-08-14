import React, { useState, useMemo, useRef, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { extractTextFromValue } from "../../types/domain";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { execute } from "../../lib/commands";
import {
  FolderIcon,
  Plus,
  ChevronDown,
  Search,
  X,
  Layers,
  Network,
  Terminal,
} from "lucide-react";
import { VStack, HStack } from "../ui/LayoutPrimitives";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";

/* --- Helper to get Kind Icon / Emoji --- */
const getKindIcon = (kind: string, kindDef?: { icon?: string; label?: string }): string => {
  if (kindDef?.icon) return kindDef.icon;
  if (kind === "core.page") return "📄";
  if (kind === "core.canvas") return "🎨";
  if (kind === "core.task") return "✓";
  if (kind === "core.database") return "🗄️";
  if (kind === "core.image") return "🖼️";
  if (kind === "core.file" || kind === "core.binary") return "📎";
  if (kind === "core.query") return "🔍";
  if (kind === "core.inbox") return "📥";
  if (kind === "core.flashcard") return "🗂️";
  return "🏷️";
};

/* --- Tree Item Sub-component (Universal Block Recursion) --- */
interface SidebarTreeItemProps {
  nodeId: string;
  depth?: number;
  searchQuery: string;
  selectedKindFilter: string | null;
}

const SidebarTreeItem: React.FC<SidebarTreeItemProps> = ({
  nodeId,
  depth = 0,
  searchQuery,
  selectedKindFilter,
}) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const kinds = useGraphStore((state) => state.kinds);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const openBuffer = useUIStore((state) => state.openBuffer);

  const [isExpanded, setIsExpanded] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false);
      }
    };
    if (showAddMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMenu]);

  if (!node) return null;

  const titleText = extractTextFromValue(node.props.title);
  const bodyText = extractTextFromValue(node.props.body);
  const title =
    titleText ||
    (bodyText ? bodyText.slice(0, 30) : "") ||
    "Untitled Block";

  const isSelected = selectedNodeId === nodeId;
  const hasChildren = node.children && node.children.length > 0;
  const kindDef = kinds[node.kind];
  const iconEmoji = getKindIcon(node.kind, kindDef);

  const handleCreateChild = (childKind: string) => {
    setShowAddMenu(false);
    const newId = crypto.randomUUID();
    const defaultTitle =
      childKind === "core.page"
        ? "Untitled Sub-page"
        : `New ${kinds[childKind]?.label || "Block"}`;
    execute({
      type: "create_node",
      id: newId,
      kind: childKind,
      parent_id: nodeId,
      index: node.children.length,
      props: {
        title: { t: "Text", v: defaultTitle },
      },
    });
    openBuffer(newId);
    setIsExpanded(true);
  };

  return (
    <div className="flex flex-col select-none relative group/item">
      {/* Indent Guide Line for Nested Levels */}
      {depth > 0 && (
        <div
          className="absolute top-0 bottom-0 border-l border-border/20 pointer-events-none"
          style={{ left: `${depth * 0.75}rem` }}
        />
      )}

      {/* Row */}
      <div
        onClick={() => openBuffer(nodeId)}
        style={{ paddingLeft: `${0.3 + depth * 0.75}rem` }}
        className={cn(
          "w-full flex items-center gap-1.5 py-1 px-1.5 rounded text-xs font-mono cursor-pointer transition-all duration-150 relative",
          isSelected
            ? "bg-primary/15 text-primary font-semibold border-l-2 border-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
        )}
      >
        {/* Expand / Collapse Chevron */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted/60 rounded text-muted-foreground hover:text-foreground transition-transform cursor-pointer"
          >
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-150",
                isExpanded ? "transform rotate-0" : "transform -rotate-90"
              )}
            />
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}

        {/* Dynamic Icon */}
        <span className="text-xs shrink-0 select-none opacity-80 group-hover/item:opacity-100 transition-opacity">
          {iconEmoji}
        </span>

        {/* Title */}
        <span className="truncate flex-1 text-xs tracking-tight">{title}</span>

        {/* Hover Kind Label */}
        <span className="text-[9px] text-muted-foreground/50 opacity-0 group-hover/item:opacity-100 transition-opacity uppercase font-mono mr-1">
          {kindDef?.label || node.kind.replace("core.", "")}
        </span>

        {/* Quick Add Sub-Block Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowAddMenu(!showAddMenu);
            }}
            className="p-0.5 opacity-0 group-hover/item:opacity-100 hover:text-foreground hover:bg-muted/60 rounded transition-all cursor-pointer"
            title="Add Sub-block"
          >
            <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground" />
          </button>

          {/* Add Sub-Block Popover */}
          {showAddMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-6 z-50 w-44 bg-card border border-border/70 shadow-xl rounded-lg p-1 text-xs font-mono animate-in fade-in zoom-in-95 duration-100"
            >
              <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/40">
                Add Sub-block
              </div>
              <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                {Object.entries(kinds).map(([kId, kDef]) => (
                  <button
                    key={kId}
                    onClick={() => handleCreateChild(kId)}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-primary/20 hover:text-primary text-left text-xs transition-colors cursor-pointer"
                  >
                    <span>{kDef.icon || "📄"}</span>
                    <span className="truncate">{kDef.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Children Tree */}
      {hasChildren && isExpanded && (
        <VStack gap="none">
          {node.children.map((childId) => (
            <SidebarTreeItem
              key={childId}
              nodeId={childId}
              depth={depth + 1}
              searchQuery={searchQuery}
              selectedKindFilter={selectedKindFilter}
            />
          ))}
        </VStack>
      )}
    </div>
  );
};

/* --- Factorized UI Building Blocks for Sidebar --- */

const SidebarContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full bg-background border-r border-border/60 flex flex-col font-mono select-none text-xs">
    {children}
  </div>
);

const SidebarFooter: React.FC<{
  onSync: () => void;
  onSwitchWorkspace: () => void;
}> = ({ onSync, onSwitchWorkspace }) => (
  <HStack justify-between="true" className="p-2 border-t border-border/60 bg-muted/10 text-xs text-muted-foreground" align="center">
    <button
      onClick={onSync}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer py-0.5 px-1 rounded hover:bg-muted/30"
      title="P2P Synchronization Network"
    >
      <Network className="w-3.5 h-3.5 text-emerald-400" />
      <span>Sync</span>
    </button>

    <button
      onClick={onSwitchWorkspace}
      className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer py-0.5 px-1 rounded hover:bg-muted/30 ml-auto"
      title="Switch Workspace Directory"
    >
      <FolderIcon className="w-3.5 h-3.5" />
      <span className="truncate max-w-24">Workspace</span>
    </button>
  </HStack>
);

/* --- Main Pro Minimalist Sidebar --- */
export const Sidebar: React.FC = () => {
  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);
  const kinds = useGraphStore((state) => state.kinds);

  const openBuffer = useUIStore((state) => state.openBuffer);
  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);
  const setTypeManagerOpen = useUIStore((state) => state.setTypeManagerOpen);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedKindFilter, setSelectedKindFilter] = useState<string | null>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
    };
    if (showCreateMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCreateMenu]);

  // Compute counts per kind
  const kindCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of Object.values(nodes)) {
      counts[node.kind] = (counts[node.kind] || 0) + 1;
    }
    return counts;
  }, [nodes]);

  // Filtered Roots / Nodes according to live Query
  const displayedNodeIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    // Parse smart query keywords like `is:task` or `is:page`
    let activeKind = selectedKindFilter;
    let textQuery = q;

    if (q.startsWith("is:")) {
      const parts = q.split(" ");
      const isPart = parts[0].replace("is:", "");
      textQuery = parts.slice(1).join(" ").trim();
      const matchKind = Object.keys(kinds).find(
        (k) => k.toLowerCase().includes(isPart) || kinds[k]?.label.toLowerCase().includes(isPart)
      );
      if (matchKind) activeKind = matchKind;
    }

    if (!activeKind && !textQuery) {
      return roots;
    }

    // When querying, search all nodes matching criteria
    return Object.values(nodes)
      .filter((node) => {
        if (activeKind && node.kind !== activeKind) return false;
        if (!textQuery) return true;

        const title = extractTextFromValue(node.props.title).toLowerCase();
        const body = extractTextFromValue(node.props.body).toLowerCase();
        return title.includes(textQuery) || body.includes(textQuery);
      })
      .map((n) => n.id);
  }, [roots, nodes, kinds, searchQuery, selectedKindFilter]);

  const handleCreateRootNode = (kind: string) => {
    setShowCreateMenu(false);
    const newId = crypto.randomUUID();
    const defaultTitle =
      kind === "core.page" ? "Untitled Page" : `New ${kinds[kind]?.label || "Block"}`;
    execute({
      type: "create_node",
      id: newId,
      kind,
      parent_id: null,
      index: roots.length,
      props: {
        title: { t: "Text", v: defaultTitle },
      },
    });
    openBuffer(newId);
  };

  const activeKindsList = useMemo(() => {
    return Object.keys(kinds).filter((kId) => (kindCounts[kId] || 0) > 0);
  }, [kinds, kindCounts]);

  const totalNodesCount = Object.keys(nodes).length;

  return (
    <SidebarContainer>
      {/* 1. Header with Controls */}
      <HStack justify-between="true" className="px-3 py-2.5 border-b border-border/60 bg-muted/20" align="center">
        <HStack gap="xs" align="center">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span className="font-bold text-xs tracking-wider text-foreground">EXPLORER</span>
          <Badge variant="muted" className="text-[9px] font-mono">
            {totalNodesCount}◆
          </Badge>
        </HStack>

        <HStack gap="xs" align="center" className="ml-auto">
          {/* Open Type Schema Manager */}
          <button
            onClick={() => setTypeManagerOpen(true)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Manage Type Schemas"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>

          {/* Quick Add Menu */}
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded font-semibold text-xs transition-colors cursor-pointer"
              title="Create New Block"
            >
              <Plus className="w-3 h-3" />
              <span>New</span>
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 top-7 z-50 w-48 bg-card border border-border/70 shadow-xl rounded-lg p-1 text-xs font-mono animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/40">
                  New Block Type
                </div>
                <div className="max-h-56 overflow-y-auto py-1 space-y-0.5">
                  {Object.entries(kinds).map(([kId, kDef]) => (
                    <button
                      key={kId}
                      onClick={() => handleCreateRootNode(kId)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-left text-xs transition-colors cursor-pointer"
                    >
                      <span>{kDef.icon || "📄"}</span>
                      <span className="truncate">{kDef.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </HStack>
      </HStack>

      {/* 2. Search & Live Query Bar */}
      <VStack gap="xs" className="p-2 border-b border-border/40 bg-muted/10">
        <div className="relative flex items-center w-full">
          <Search className="w-3 h-3 text-muted-foreground absolute left-2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search / is:task ..."
            className="w-full bg-background border border-border/60 rounded pl-7 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* 3. Compact Type Filter Chips */}
        {activeKindsList.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pt-1 no-scrollbar w-full">
            <button
              onClick={() => setSelectedKindFilter(null)}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0 font-mono",
                selectedKindFilter === null
                  ? "bg-primary/20 text-primary font-bold border border-primary/30"
                  : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              All ({totalNodesCount})
            </button>

            {activeKindsList.map((kId) => {
              const def = kinds[kId];
              const isSelected = selectedKindFilter === kId;
              const count = kindCounts[kId] || 0;

              return (
                <button
                  key={kId}
                  onClick={() => setSelectedKindFilter(isSelected ? null : kId)}
                  className={cn(
                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap transition-colors cursor-pointer shrink-0 font-mono",
                    isSelected
                      ? "bg-primary/20 text-primary font-bold border border-primary/30"
                      : "bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <span>{def?.icon || "📄"}</span>
                  <span>{def?.label || kId.replace("core.", "")}</span>
                  <span className="opacity-60 text-[9px]">({count})</span>
                </button>
              );
            })}
          </div>
        )}
      </VStack>

      {/* 4. Tree / Outline View */}
      <div className="flex-1 overflow-y-auto p-2">
        <VStack gap="xs">
          {displayedNodeIds.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground/60 italic font-mono">
              {searchQuery || selectedKindFilter
                ? "[NO MATCHING BLOCKS]"
                : "[EMPTY WORKSPACE — CLICK + NEW]"}
            </div>
          ) : (
            displayedNodeIds.map((id) => (
              <SidebarTreeItem
                key={id}
                nodeId={id}
                depth={0}
                searchQuery={searchQuery}
                selectedKindFilter={selectedKindFilter}
              />
            ))
          )}
        </VStack>
      </div>

      {/* 5. Minimalist Footer */}
      <SidebarFooter
        onSync={() => setSyncPanelOpen(true)}
        onSwitchWorkspace={() => setWorkspacePickerOpen(true)}
      />
    </SidebarContainer>
  );
};

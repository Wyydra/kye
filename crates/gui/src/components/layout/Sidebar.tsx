import React, { useState, useMemo } from "react";
import { useGraphStore } from "../../store/graphStore";
import { val } from "../../types/domain";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { execute } from "../../lib/commands";
import {
  FolderIcon,
  Plus,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Network,
  Layout,
  Table,
  Terminal,
} from "lucide-react";
import { VStack, HStack } from "../ui/LayoutPrimitives";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";

/* --- Factorized UI Building Blocks for Sidebar --- */

const SidebarContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full h-full bg-background border-r border-border/60 flex flex-col font-mono select-none">
    {children}
  </div>
);

const SidebarHeader: React.FC<{ title: string; count: number }> = ({ title, count }) => (
  <HStack className="p-2.5 border-b border-border/60 bg-muted/20" align="center">
    <Terminal className="w-3.5 h-3.5 text-primary" />
    <span className="font-bold text-xs tracking-wider text-foreground">{title}</span>
    <Badge variant="muted" className="ml-auto text-[9px] font-mono">
      {count}◆
    </Badge>
  </HStack>
);

const SidebarNewBufferButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div className="p-2 border-b border-border/40">
    <button
      onClick={onClick}
      className="w-full flex items-center justify-center gap-1.5 px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded font-semibold text-xs transition-all cursor-pointer"
    >
      <Plus className="w-3.5 h-3.5" />
      <span>New Buffer</span>
    </button>
  </div>
);

const SidebarTreeItemRow: React.FC<{
  selected: boolean;
  depth: number;
  title: string;
  hasChildren: boolean;
  isExpanded: boolean;
  IconComponent: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  onToggleExpand: (e: React.MouseEvent) => void;
  onCreateSubPage: (e: React.MouseEvent) => void;
}> = ({
  selected,
  depth,
  title,
  hasChildren,
  isExpanded,
  IconComponent,
  onClick,
  onToggleExpand,
  onCreateSubPage,
}) => (
  <div
    onClick={onClick}
    style={{ paddingLeft: `${0.4 + depth * 0.6}rem` }}
    className={cn(
      "w-full flex items-center gap-1.5 py-1 px-1.5 rounded transition-all text-xs font-mono cursor-pointer group select-none",
      selected
        ? "bg-primary/20 text-primary font-bold border border-primary/30"
        : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
    )}
  >
    {hasChildren ? (
      <button
        onClick={onToggleExpand}
        className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-transform cursor-pointer"
      >
        <ChevronDown
          className={cn(
            "w-3 h-3 transition-transform duration-200",
            isExpanded ? "transform rotate-0" : "transform -rotate-90"
          )}
        />
      </button>
    ) : (
      <span className="w-3 h-3 shrink-0" />
    )}

    <IconComponent
      className={cn(
        "w-3 h-3 shrink-0 transition-opacity",
        selected ? "text-primary opacity-100" : "opacity-60 group-hover:opacity-100"
      )}
    />

    <span className="truncate flex-1">{title}</span>

    <button
      onClick={onCreateSubPage}
      className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity cursor-pointer"
      title="Add Sub-note"
    >
      <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground" />
    </button>
  </div>
);

const SidebarFooter: React.FC<{
  onSync: () => void;
  onSwitchWorkspace: () => void;
}> = ({ onSync, onSwitchWorkspace }) => (
  <VStack gap="xs" className="p-2 border-t border-border/60 bg-muted/10">
    <button
      onClick={onSync}
      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <Network className="w-3.5 h-3.5 text-emerald-400" />
      <span className="truncate">Sync Network</span>
    </button>
    <button
      onClick={onSwitchWorkspace}
      className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground cursor-pointer"
    >
      <FolderIcon className="w-3.5 h-3.5" />
      <span className="truncate">Switch Directory</span>
    </button>
  </VStack>
);

/* --- Tree Item Sub-component --- */

interface SidebarTreeItemProps {
  nodeId: string;
  depth?: number;
}

const SidebarTreeItem: React.FC<SidebarTreeItemProps> = ({ nodeId, depth = 0 }) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const nodes = useGraphStore((state) => state.nodes);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const openBuffer = useUIStore((state) => state.openBuffer);

  const [isExpanded, setIsExpanded] = useState(true);

  if (!node) return null;

  const childDocumentIds = node.children.filter((childId) => {
    const child = nodes[childId];
    return (
      child &&
      (child.kind === "core.page" ||
        child.kind === "core.canvas" ||
        child.kind === "core.database")
    );
  });

  const title = val<string>(node.props.title) || "Untitled Note";
  const isSelected = selectedNodeId === nodeId;
  const hasChildren = childDocumentIds.length > 0;

  let IconComponent = FileText;
  if (node.kind === "core.image" || node.kind === "core.file") IconComponent = ImageIcon;
  else if (node.kind === "core.canvas") IconComponent = Layout;
  else if (node.kind === "core.database") IconComponent = Table;

  const handleCreateSubPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: "core.page",
      parent_id: nodeId,
      index: node.children.length,
      props: {
        title: { t: "Text", v: "Untitled Sub-note" },
      },
    });
    openBuffer(newId);
    setIsExpanded(true);
  };

  return (
    <VStack gap="none">
      <SidebarTreeItemRow
        selected={isSelected}
        depth={depth}
        title={title}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        IconComponent={IconComponent}
        onClick={() => openBuffer(nodeId)}
        onToggleExpand={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        onCreateSubPage={handleCreateSubPage}
      />

      {hasChildren && isExpanded && (
        <VStack gap="none">
          {childDocumentIds.map((childId) => (
            <SidebarTreeItem key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </VStack>
      )}
    </VStack>
  );
};

/* --- Main Functional Component (0 Raw CSS Strings in JSX) --- */

export const Sidebar: React.FC = () => {
  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);

  const documentRoots = useMemo(() => {
    return roots.filter((id) => {
      const node = nodes[id];
      return (
        node &&
        (node.kind === "core.page" ||
          node.kind === "core.canvas" ||
          node.kind === "core.database")
      );
    });
  }, [roots, nodes]);

  const openBuffer = useUIStore((state) => state.openBuffer);
  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);

  const handleCreateNote = () => {
    const newId = crypto.randomUUID();
    const rootCount = useGraphStore.getState().roots.length;
    execute({
      type: "create_node",
      id: newId,
      kind: "core.page",
      parent_id: null,
      index: rootCount,
      props: {
        title: { t: "Text", v: "Untitled Note" },
      },
    });
    openBuffer(newId);
  };

  return (
    <SidebarContainer>
      <SidebarHeader title="NVIM_TREE" count={documentRoots.length} />
      <SidebarNewBufferButton onClick={handleCreateNote} />

      <div className="flex-1 overflow-y-auto p-2">
        <VStack gap="xs">
          {documentRoots.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground/60 italic font-mono">
              [EMPTY WORKSPACE — CLICK NEW BUFFER]
            </div>
          ) : (
            documentRoots.map((id) => <SidebarTreeItem key={id} nodeId={id} depth={0} />)
          )}
        </VStack>
      </div>

      <SidebarFooter
        onSync={() => setSyncPanelOpen(true)}
        onSwitchWorkspace={() => setWorkspacePickerOpen(true)}
      />
    </SidebarContainer>
  );
};

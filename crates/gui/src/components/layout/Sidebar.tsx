import React, { useState } from "react";
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
  PanelLeft,
  Network,
  Layout,
  Table,
  BookOpen,
} from "lucide-react";

interface SidebarTreeItemProps {
  nodeId: string;
  depth?: number;
}

const SidebarTreeItem: React.FC<SidebarTreeItemProps> = ({ nodeId, depth = 0 }) => {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const nodes = useGraphStore((state) => state.nodes);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);

  const [isExpanded, setIsExpanded] = useState(true);

  if (!node) return null;

  // Filter child nodes that are document-level nodes (pages, canvases, etc.)
  const childDocumentIds = node.children.filter((childId) => {
    const child = nodes[childId];
    return (
      child &&
      (child.kind === "core.page" ||
        child.kind === "core.canvas" ||
        child.kind === "core.database" ||
        child.kind === "core.image")
    );
  });

  const title = val<string>(node.props.title) || "Untitled Note";
  const isSelected = selectedNodeId === nodeId;
  const hasChildren = childDocumentIds.length > 0;

  let IconComponent = FileText;
  if (node.kind === "core.image") IconComponent = ImageIcon;
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
    setSelectedNodeId(newId);
    setActiveViewMode("editor");
    setIsExpanded(true);
  };

  return (
    <div className="space-y-0.5">
      <div
        onClick={() => {
          setSelectedNodeId(nodeId);
          setActiveViewMode("editor");
        }}
        style={{ paddingLeft: `${0.5 + depth * 0.75}rem` }}
        className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-xl transition-all text-xs cursor-pointer group select-none ${
          isSelected
            ? "bg-primary/15 text-primary font-semibold border border-primary/20 shadow-xs"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
        }`}
      >
        {/* Toggle Expand Arrow */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-transform"
          >
            <ChevronDown
              className={`w-3 h-3 transition-transform duration-200 ${
                isExpanded ? "transform rotate-0" : "transform -rotate-90"
              }`}
            />
          </button>
        ) : (
          <span className="w-3 h-3 shrink-0" />
        )}

        <IconComponent
          className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
            isSelected ? "text-primary opacity-100" : "opacity-60 group-hover:opacity-100"
          }`}
        />

        <span className="truncate flex-1">{title}</span>

        {/* Add Sub-page Button on hover */}
        <button
          onClick={handleCreateSubPage}
          className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-foreground transition-opacity"
          title="Add Sub-note"
        >
          <Plus className="w-3 h-3 text-muted-foreground hover:text-foreground" />
        </button>
      </div>

      {/* Render Child Documents recursively if expanded */}
      {hasChildren && isExpanded && (
        <div className="space-y-0.5">
          {childDocumentIds.map((childId) => (
            <SidebarTreeItem key={childId} nodeId={childId} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const roots = useGraphStore((state) => state.roots);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);

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
    setSelectedNodeId(newId);
    setActiveViewMode("editor");
  };

  const handleSwitchWorkspace = () => {
    setWorkspacePickerOpen(true);
  };

  return (
    <div className="w-full h-full bg-background border-r border-border/60 flex flex-col shadow-2xl select-none">
      {/* Header */}
      <div
        className="p-4 border-b border-border/50 flex items-center justify-between bg-card/30 backdrop-blur-md"
        style={{
          paddingTop: "calc(1rem + var(--safe-top))",
          paddingLeft: "calc(1rem + var(--safe-left))",
        }}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => useUIStore.getState().toggleSidebar()}
            className="p-1.5 hover:bg-muted/80 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 bg-primary rounded-md flex items-center justify-center shadow-sm shadow-primary/30">
            <span className="text-[10px] font-black text-primary-foreground italic">K</span>
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground/90">Kye Notes</span>
        </div>
        <button
          onClick={() => setSyncPanelOpen(true)}
          className="p-1.5 hover:bg-muted/80 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
          title="P2P Sync"
        >
          <Network className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleCreateNote}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-xl font-medium text-xs transition-all shadow-xs group"
        >
          <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
          <span>New Note</span>
        </button>
      </div>

      {/* Documents Tree List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        <div className="px-2 py-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" />
            Documents
          </span>
          <button
            onClick={handleCreateNote}
            className="hover:text-foreground transition-colors p-0.5"
            title="Create Document"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-0.5">
          {roots.length === 0 ? (
            <div className="p-3 text-center text-xs text-muted-foreground/60 italic">
              No notes yet. Click + New Note above.
            </div>
          ) : (
            roots.map((id) => <SidebarTreeItem key={id} nodeId={id} depth={0} />)
          )}
        </div>
      </div>

      {/* Footer */}
      <div
        className="p-3 border-t border-border/50 bg-card/20 space-y-1"
        style={{
          paddingBottom: "calc(0.75rem + var(--safe-bottom))",
          paddingLeft: "calc(0.75rem + var(--safe-left))",
        }}
      >
        <button
          onClick={() => setSyncPanelOpen(true)}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 transition-colors text-xs text-muted-foreground hover:text-foreground"
        >
          <Network className="w-3.5 h-3.5 text-primary/80" />
          <span className="truncate">P2P Sync Network</span>
        </button>
        <button
          onClick={handleSwitchWorkspace}
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/80 transition-colors text-xs text-muted-foreground hover:text-foreground"
        >
          <FolderIcon className="w-3.5 h-3.5" />
          <span className="truncate">Switch Workspace</span>
        </button>
      </div>
    </div>
  );
};

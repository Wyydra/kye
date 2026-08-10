import React from "react";
import { useUIStore, ViewMode } from "../../store/uiStore";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { val } from "../../types/domain";
import { execute } from "../../lib/commands";
import { PanelLeft, Plus, FileText, LayoutGrid, Edit3, X } from "lucide-react";
import { cn } from "../../lib/utils";

const BufferBarContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <header className="h-9 bg-muted/40 border-b border-border/60 flex items-center justify-between px-2 shrink-0 select-none text-xs font-mono">
    {children}
  </header>
);

const BufferListContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
    {children}
  </div>
);

const BufferIconButton: React.FC<{
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, title, children, className }) => (
  <button
    onClick={onClick}
    className={cn("p-1 hover:bg-muted rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer", className)}
    title={title}
  >
    {children}
  </button>
);

const BufferTabItem: React.FC<{
  active: boolean;
  title: string;
  onClick: () => void;
  onClose: (e: React.MouseEvent) => void;
}> = ({ active, title, onClick, onClose }) => (
  <div
    onClick={onClick}
    className={cn(
      "group flex items-center gap-1.5 px-2.5 py-1 rounded-t border-t border-x transition-all cursor-pointer",
      active
        ? "bg-background border-border text-foreground font-semibold shadow-2xs"
        : "bg-muted/20 border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
    )}
  >
    <FileText className="w-3 h-3 text-primary/70 shrink-0" />
    <span className="truncate max-w-[120px]">{title}</span>
    <button
      onClick={onClose}
      className="p-0.5 opacity-60 hover:opacity-100 hover:bg-muted rounded transition-opacity cursor-pointer"
      title="Close Buffer"
    >
      <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
    </button>
  </div>
);

const BufferModeSwitcher: React.FC<{
  activeMode: ViewMode;
  onSelectMode: (mode: ViewMode) => void;
}> = ({ activeMode, onSelectMode }) => (
  <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded border border-border/50">
    <button
      onClick={() => onSelectMode("editor")}
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer",
        activeMode === "editor"
          ? "bg-background text-foreground font-semibold shadow-2xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Edit3 className="w-3 h-3" />
      <span>Editor</span>
    </button>
    <button
      onClick={() => onSelectMode("graph")}
      className={cn(
        "flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer",
        activeMode === "graph"
          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <LayoutGrid className="w-3 h-3" />
      <span>Graph</span>
    </button>
  </div>
);

export const BufferBar: React.FC = () => {
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const activeViewMode = useUIStore((state) => state.activeViewMode);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);

  const openBufferIds = useUIStore((state) => state.openBufferIds);
  const openBuffer = useUIStore((state) => state.openBuffer);
  const closeBuffer = useUIStore((state) => state.closeBuffer);

  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);

  const handleCreateNote = () => {
    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: "core.page",
      parent_id: null,
      index: roots.length,
      props: {
        title: { t: "Text", v: "Untitled Note" },
      },
    });
    openBuffer(newId);
  };

  return (
    <BufferBarContainer>
      <BufferListContainer>
        <BufferIconButton onClick={toggleSidebar} title="Toggle NvimTree Sidebar" className="mr-1">
          <PanelLeft className="w-3.5 h-3.5" />
        </BufferIconButton>

        {openBufferIds.length === 0 ? (
          <span className="text-[11px] text-muted-foreground/60 px-2 italic">
            [No open buffers]
          </span>
        ) : (
          openBufferIds.map((id) => {
            const node = nodes[id];
            const isActive = selectedNodeId === id && activeViewMode === "editor";
            const title = node ? val<string>(node.props["title"]) || "Untitled" : "Closed";

            return (
              <BufferTabItem
                key={id}
                active={isActive}
                title={title}
                onClick={() => {
                  setSelectedNodeId(id);
                  setActiveViewMode("editor");
                }}
                onClose={(e) => {
                  e.stopPropagation();
                  closeBuffer(id);
                }}
              />
            );
          })
        )}

        <BufferIconButton onClick={handleCreateNote} title="New Buffer (+)" className="ml-1">
          <Plus className="w-3.5 h-3.5" />
        </BufferIconButton>
      </BufferListContainer>

      <BufferModeSwitcher activeMode={activeViewMode} onSelectMode={setActiveViewMode} />
    </BufferBarContainer>
  );
};

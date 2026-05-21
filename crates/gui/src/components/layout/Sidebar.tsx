import { useGraphStore } from "../../store/graphStore";
import { val } from "../../types/domain";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { FolderIcon, Settings, Plus, ChevronRight, FileText, Image as ImageIcon, PanelLeft } from "lucide-react";

export const Sidebar: React.FC = () => {
  const roots = useGraphStore(state => state.roots);
  const nodes = useGraphStore(state => state.nodes);
  const setSelectedNodeId = useCanvasStore(state => state.setSelectedNodeId);

  const setWorkspacePickerOpen = useUIStore(state => state.setWorkspacePickerOpen);

  const handleSwitchWorkspace = () => {
    setWorkspacePickerOpen(true);
  };

  return (
    <div className="w-full h-full bg-background/60 backdrop-blur-xl border-r border-border/50 flex flex-col shadow-2xl">
      {}
      <div 
        className="p-4 border-b border-border/50 flex items-center justify-between"
        style={{ paddingTop: "calc(1rem + var(--safe-top))", paddingLeft: "calc(1rem + var(--safe-left))" }}
      >
        <div className="flex items-center gap-2">
          <button 
            onClick={() => useUIStore.getState().toggleSidebar()}
            className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground mr-1"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
          <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary-foreground italic">K</span>
          </div>
          <span className="font-semibold text-sm tracking-tight">Kye</span>
        </div>
        <button className="p-1 hover:bg-muted rounded-md transition-colors text-muted-foreground">
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-4 mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
          <span>Documents</span>
          <button className="hover:text-foreground transition-colors">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="space-y-0.5 px-2">
          {roots.map(id => {
            const node = nodes[id];
            if (!node) return null;

            const title = val<string>(node.props.title) || "Untitled";
            const isImage = node.kind === "core.image";

            return (
              <button
                key={id}
                onClick={() => setSelectedNodeId(id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted group transition-all text-sm text-left text-muted-foreground hover:text-foreground"
              >
                <div className="flex-shrink-0">
                  {isImage ? <ImageIcon className="w-4 h-4 opacity-40 group-hover:opacity-100" /> : <FileText className="w-4 h-4 opacity-40 group-hover:opacity-100" />}
                </div>
                <span className="truncate flex-1">{title}</span>
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
              </button>
            );
          })}
        </div>
      </div>

      {}
      <div 
        className="p-4 border-t border-border/50 bg-muted/10"
        style={{ paddingBottom: "calc(1rem + var(--safe-bottom))", paddingLeft: "calc(1rem + var(--safe-left))" }}
      >
        <button 
          onClick={handleSwitchWorkspace}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-muted transition-colors text-xs text-muted-foreground hover:text-foreground"
        >
          <FolderIcon className="w-4 h-4" />
          <span>Switch Workspace</span>
        </button>
      </div>
    </div>
  );
};

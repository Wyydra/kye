import { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { execute } from "../../lib/commands";
import { val } from "../../types/domain";

import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import { NodeRenderer } from "../renderers/NodeRenderer";
import { NodeModal } from "./NodeModal";
import { DropManager } from "../../lib/dropManager";
import { Sidebar } from "./Sidebar";
import { MobileLayout } from "./MobileLayout";

import {
  PanelLeft,
  FolderOpen,
  Sparkles,
  Edit3,
  LayoutGrid,
  Plus,
  FileText,
  Network,
} from "lucide-react";
import { WorkspacePicker } from "./WorkspacePicker";
import { SyncPanel } from "../SyncPanel";

export const MainLayout: React.FC = () => {
  const { isLoaded, loadGraph, error } = useGraphStore();
  const nodes = useGraphStore((state) => state.nodes);

  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);

  const activeViewMode = useUIStore((state) => state.activeViewMode);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);

  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const setWorkspacePickerOpen = useUIStore(
    (state) => state.setWorkspacePickerOpen
  );
  const isSyncPanelOpen = useUIStore((state) => state.isSyncPanelOpen);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    DropManager.init();

    Promise.all([kyeService.getMeta(), kyeService.getWorkspacePath()])
      .then(([_, path]) => {
        setWorkspacePath(path);
      })
      .catch(console.error);
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (error && error.includes("No workspace selected")) {
      setWorkspacePickerOpen(true);
    }
  }, [error, setWorkspacePickerOpen]);

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

  const activeNode = selectedNodeId ? nodes[selectedNodeId] : null;
  const activeNodeTitle = activeNode
    ? val<string>(activeNode.props.title) || "Untitled Note"
    : "No Document Selected";

  if (error && error.includes("No workspace selected")) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground p-8 overflow-hidden select-none">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-primary/20 animate-in zoom-in-50 duration-700">
          <span className="text-4xl font-black text-primary-foreground italic">
            K
          </span>
        </div>

        <div className="text-center space-y-4 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          <h1 className="text-4xl font-black tracking-tight flex items-center justify-center gap-3">
            Welcome to Kye
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Your personal note studio. Open a workspace folder to start writing.
          </p>
        </div>

        <div className="mt-12 grid gap-4 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-500">
          <button
            onClick={() => setWorkspacePickerOpen(true)}
            className="flex items-center justify-between p-6 bg-card border border-border hover:border-primary/50 rounded-2xl transition-all group shadow-sm hover:shadow-xl hover:shadow-primary/5"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <p className="font-bold">Open Workspace</p>
                <p className="text-xs text-muted-foreground">
                  Select a local project folder
                </p>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <WorkspacePicker />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none">
        <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-xl max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">
            Workspace Error
          </h2>
          <p className="text-sm text-destructive/80 font-mono">{error}</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (isMobile) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden relative">
        <MobileLayout />
        <WorkspacePicker />
        {isSyncPanelOpen && (
          <SyncPanel onClose={() => setSyncPanelOpen(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden relative">
      {/* Sidebar Overlay */}
      <div
        className={`absolute top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      {/* Main Container */}
      <div
        className={`flex-1 h-full flex flex-col transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarOpen ? "ml-72" : "ml-0"
        }`}
      >
        {/* Top Header Navbar */}
        <header
          className="h-14 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 flex items-center justify-between shrink-0 z-30 select-none"
          style={{ paddingTop: "calc(0.25rem + var(--safe-top))" }}
        >
          {/* Left: Sidebar toggle & Document title */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-muted/80 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium truncate max-w-xs sm:max-w-md">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate text-foreground font-semibold">
                {activeNodeTitle}
              </span>
            </div>
          </div>

          {/* Center: View Switcher (Note Editor vs Graph View) */}
          <div className="flex items-center p-1 bg-muted/60 border border-border/60 rounded-xl text-xs font-medium">
            <button
              onClick={() => setActiveViewMode("editor")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                activeViewMode === "editor"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Note Editor</span>
            </button>
            <button
              onClick={() => setActiveViewMode("graph")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                activeViewMode === "graph"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Graph View</span>
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-lg text-xs font-medium transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Note</span>
            </button>
            <button
              onClick={() => setSyncPanelOpen(true)}
              className="p-1.5 hover:bg-muted/80 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
              title="Sync Workspace"
            >
              <Network className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 h-full overflow-hidden relative">
          {activeViewMode === "graph" ? (
            <CanvasLayout />
          ) : selectedNodeId ? (
            <div className="h-full w-full overflow-y-auto bg-background">
              <NodeRenderer nodeId={selectedNodeId} depth={0} />
            </div>
          ) : (
            /* Empty State */
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 text-center bg-background select-none">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 border border-primary/20 shadow-lg shadow-primary/5 animate-in zoom-in-50 duration-500">
                <FileText className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                No Document Selected
              </h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-6 leading-relaxed">
                Select a note from the sidebar to start writing, or create a
                new document.
              </p>
              <button
                onClick={handleCreateNote}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs rounded-xl shadow-md transition-all hover:scale-102"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Note</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Modals & Popups */}
      <NodeModal />
      <WorkspacePicker />

      {/* Workspace Path Badge */}
      {workspacePath && (
        <div
          style={{
            bottom: "calc(0.5rem + var(--safe-bottom))",
            right: "calc(0.5rem + var(--safe-right))",
          }}
          className="absolute pointer-events-none px-2.5 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[9px] font-mono text-white/40 z-30"
        >
          {workspacePath}
        </div>
      )}

      {isSyncPanelOpen && (
        <SyncPanel onClose={() => setSyncPanelOpen(false)} />
      )}
    </div>
  );
};

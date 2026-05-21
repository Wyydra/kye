import { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { kyeService } from "../../services/kyeService";

import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import { NodeModal } from "./NodeModal";
import { DropManager } from "../../lib/dropManager";
import { Sidebar } from "./Sidebar";
import { MobileLayout } from "./MobileLayout";

import { PanelLeft, FolderOpen, Sparkles } from "lucide-react";
import { WorkspacePicker } from "./WorkspacePicker";
import { SyncPanel } from "../SyncPanel";
import { useUIStore } from "../../store/uiStore";
import { bootstrapLayouts } from "../renderers/layouts";

export const MainLayout: React.FC = () => {
  const { isLoaded, loadGraph, error } = useGraphStore();
  const isSidebarOpen = useUIStore(state => state.isSidebarOpen);
  const toggleSidebar = useUIStore(state => state.toggleSidebar);
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  const setWorkspacePickerOpen = useUIStore(state => state.setWorkspacePickerOpen);
  const isSyncPanelOpen = useUIStore(state => state.isSyncPanelOpen);
  const setSyncPanelOpen = useUIStore(state => state.setSyncPanelOpen);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    bootstrapLayouts();
    DropManager.init();

    Promise.all([
      kyeService.getMeta(),
      kyeService.getWorkspacePath()
    ]).then(([_, path]) => {
      setWorkspacePath(path);
    }).catch(console.error);
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (error && error.includes("No workspace selected")) {
      setWorkspacePickerOpen(true);
    }
  }, [error, setWorkspacePickerOpen]);

  if (error && error.includes("No workspace selected")) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-foreground p-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />

        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-primary/20 animate-in zoom-in-50 duration-700">
          <span className="text-4xl font-black text-primary-foreground italic">K</span>
        </div>

        <div className="text-center space-y-4 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-200">
          <h1 className="text-4xl font-black tracking-tight flex items-center justify-center gap-3">
            Welcome to Kye
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Your creative spatial canvas. To get started, you need to open or create a workspace folder.
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
                <p className="text-xs text-muted-foreground">Select a local project folder</p>
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
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
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
        {isSyncPanelOpen && <SyncPanel onClose={() => setSyncPanelOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden relative">
      {}
      <div 
        className={`absolute top-0 left-0 h-full z-50 transition-all duration-300 ease-in-out overflow-hidden ${
          isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full"
        }`}
      >
        <Sidebar />
      </div>

      {}
      <div className="flex-1 h-full relative overflow-hidden">
        {}
        <button 
          onClick={toggleSidebar}
          style={{ top: "calc(0.75rem + var(--safe-top))", left: "calc(0.75rem + var(--safe-left))" }}
          className={`absolute z-40 p-2 bg-background/80 backdrop-blur-md border border-border rounded-lg shadow-sm hover:bg-muted transition-all ${
            isSidebarOpen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <PanelLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        <CanvasLayout />
      </div>

      {}
      <NodeModal />

      {}
      <WorkspacePicker />

      {}
      {workspacePath && (
        <div 
          style={{ bottom: "calc(0.5rem + var(--safe-bottom))", left: "calc(0.5rem + var(--safe-left))" }}
          className="absolute pointer-events-none px-2 py-0.5 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[9px] font-mono text-white/30 z-50"
        >
          WS: {workspacePath}
        </div>
      )}
      {isSyncPanelOpen && <SyncPanel onClose={() => setSyncPanelOpen(false)} />}
    </div>
  );
};

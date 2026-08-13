import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import { NodeRenderer } from "../renderers/NodeRenderer";
import { NodeModal } from "./NodeModal";
import { DropManager } from "../../lib/dropManager";
import { Sidebar } from "./Sidebar";
import { MobileLayout } from "./MobileLayout";
import { WorkspacePicker } from "./WorkspacePicker";
import { SyncPanel } from "../SyncPanel";
import { BufferBar } from "./BufferBar";
import { StatusBar } from "./StatusBar";
import { TypeManagerModal } from "../editors/TypeManagerModal";
import { cn } from "../../lib/utils";

/* --- Factorized UI Building Blocks for MainLayout --- */

const MainLayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden relative select-none font-sans">
    {children}
  </div>
);

const SidebarDockContainer: React.FC<{ isOpen: boolean; children: React.ReactNode }> = ({
  isOpen,
  children,
}) => (
  <div
    className={cn(
      "absolute top-0 left-0 h-full z-40 transition-all duration-200 ease-in-out overflow-hidden border-r border-border/60",
      isOpen ? "w-64 translate-x-0 shadow-lg" : "w-0 -translate-x-full pointer-events-none"
    )}
  >
    {children}
  </div>
);

const MainWorkspaceViewport: React.FC<{ isSidebarOpen: boolean; children: React.ReactNode }> = ({
  isSidebarOpen,
  children,
}) => (
  <div
    className={cn(
      "flex-1 h-full flex flex-col transition-all duration-200 ease-in-out overflow-hidden",
      isSidebarOpen ? "ml-64" : "ml-0"
    )}
  >
    <main className="flex-1 h-full overflow-hidden relative">{children}</main>
  </div>
);

const MainDocumentContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-full w-full overflow-y-auto bg-background p-6 md:p-12">
    <div className="max-w-4xl mx-auto">{children}</div>
  </div>
);

const MainEmptyState: React.FC = () => (
  <div className="flex-1 h-full flex items-center justify-center text-muted-foreground/50 text-xs font-mono select-none">
    <span>[NO BUFFER SELECTED — PRESS + TO CREATE NOTE]</span>
  </div>
);

/* --- Main Functional Component (Academic Hexagonal Lifecycle State Machine) --- */

export const MainLayout: React.FC = () => {
  const { loadGraph, appLifecycle } = useGraphStore();
  const isSidebarOpen = useUIStore((state) => state.isSidebarOpen);
  const activeViewMode = useUIStore((state) => state.activeViewMode);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);

  const [isMobile, setIsMobile] = useState(false);

  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);
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
      .then(([_, _path]) => {
        // Workspace path initialized
      })
      .catch(console.error);

    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (appLifecycle.status === "NO_WORKSPACE") {
      setWorkspacePickerOpen(true);
    }
  }, [appLifecycle.status, setWorkspacePickerOpen]);

  // Pattern Matching on Explicit App Lifecycle State Machine
  if (appLifecycle.status === "FATAL_ERROR") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none font-mono">
        <div className="p-6 border border-destructive/20 bg-destructive/5 rounded-xl max-w-md">
          <h2 className="text-xl font-bold text-destructive mb-2">
            [WORKSPACE ERROR]
          </h2>
          <p className="text-sm text-destructive/80">{appLifecycle.message}</p>
        </div>
      </div>
    );
  }

  if (appLifecycle.status === "UNINITIALIZED" || appLifecycle.status === "LOADING_WORKSPACE") {
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

  const effectiveSelectedId = selectedNodeId || useGraphStore.getState().roots[0];

  return (
    <MainLayoutContainer>
      <BufferBar />

      <div className="flex flex-1 w-full overflow-hidden relative">
        <SidebarDockContainer isOpen={isSidebarOpen}>
          <Sidebar />
        </SidebarDockContainer>

        <MainWorkspaceViewport isSidebarOpen={isSidebarOpen}>
          {activeViewMode === "graph" ? (
            <CanvasLayout />
          ) : effectiveSelectedId ? (
            <MainDocumentContainer>
              <NodeRenderer nodeId={effectiveSelectedId} depth={0} />
            </MainDocumentContainer>
          ) : (
            <MainEmptyState />
          )}
        </MainWorkspaceViewport>
      </div>

      <StatusBar />

      {/* Modals & Pickers */}
      <NodeModal />
      <WorkspacePicker />
      <TypeManagerModal />
      {isSyncPanelOpen && (
        <SyncPanel onClose={() => setSyncPanelOpen(false)} />
      )}
    </MainLayoutContainer>
  );
};

import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import { NodeRenderer } from "../renderers/NodeRenderer";
import { NodeModal } from "./NodeModal";
import { DropManager } from "../../lib/dropManager";
import { FloatingIsland } from "./FloatingIsland";
import { MobileLayout } from "./MobileLayout";
import { WelcomeScreen } from "../workspace/WelcomeScreen";
import { CreateWorkspaceModal } from "../workspace/CreateWorkspaceModal";
import { WorkspaceSwitcherModal } from "../workspace/WorkspaceSwitcherModal";
import { SyncPanel } from "../SyncPanel";
import { TypeManagerModal } from "../editors/TypeManagerModal";
import { BlockInspectorPanel } from "./BlockInspectorPanel";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { EmptyState } from "../ui/EmptyState";

export const MainLayout: React.FC = () => {
  const { loadGraph, appLifecycle } = useGraphStore();
  const activeViewMode = useUIStore((state) => state.activeViewMode);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);

  const [isMobile, setIsMobile] = useState(false);
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

  // Pattern Matching on App Lifecycle State Machine
  if (appLifecycle.status === "FATAL_ERROR") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground select-none font-sans p-4">
        <div className="p-6 border border-destructive/30 bg-destructive/10 rounded-2xl max-w-md space-y-3">
          <h2 className="text-sm font-bold text-destructive">
            WORKSPACE ERROR
          </h2>
          <p className="text-xs text-destructive/80 leading-relaxed">{appLifecycle.message}</p>
          <div className="pt-2">
            <Button
              variant="danger"
              size="xs"
              onClick={() => useGraphStore.getState().closeWorkspace()}
            >
              Back to Start Screen
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (appLifecycle.status === "UNINITIALIZED" || appLifecycle.status === "LOADING_WORKSPACE") {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-foreground">
        <Spinner size="md" label="Loading workspace..." />
      </div>
    );
  }

  if (appLifecycle.status === "NO_WORKSPACE") {
    return (
      <>
        <WelcomeScreen />
        <CreateWorkspaceModal />
        <WorkspaceSwitcherModal />
      </>
    );
  }

  if (isMobile) {
    return (
      <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden relative">
        <MobileLayout />
        <CreateWorkspaceModal />
        <WorkspaceSwitcherModal />
        {isSyncPanelOpen && (
          <SyncPanel onClose={() => setSyncPanelOpen(false)} />
        )}
      </div>
    );
  }

  const effectiveSelectedId = selectedNodeId || useGraphStore.getState().roots[0];

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden relative select-none font-sans">
      {/* 1. Classic Floating Island Navigation Hub */}
      <FloatingIsland />

      {/* 2. Full-Screen 100% Immersive Viewport with Side Inspector */}
      <div className="flex-1 w-full h-full flex overflow-hidden relative">
        <main className="flex-1 h-full overflow-hidden relative">
          {activeViewMode === "graph" ? (
            <CanvasLayout />
          ) : effectiveSelectedId ? (
            <div className="h-full w-full overflow-y-auto bg-background pt-20 pb-16 px-6 md:px-12">
              <div className="max-w-4xl mx-auto pl-12 pr-6">
                <NodeRenderer nodeId={effectiveSelectedId} depth={0} />
              </div>
            </div>
          ) : (
            <div className="flex-1 h-full flex items-center justify-center">
              <EmptyState
                title="No document selected"
                description="Open a document from the floating island above or click + to create a note."
                bordered={false}
              />
            </div>
          )}
        </main>

        {/* Selection Inspector Side Panel */}
        <BlockInspectorPanel />
      </div>

      {/* 3. Global Modals & Switchers */}
      <NodeModal />
      <CreateWorkspaceModal />
      <WorkspaceSwitcherModal />
      <TypeManagerModal />
      {isSyncPanelOpen && (
        <SyncPanel onClose={() => setSyncPanelOpen(false)} />
      )}
    </div>
  );
};

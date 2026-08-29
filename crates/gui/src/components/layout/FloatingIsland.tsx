import React, { useState, useRef, useEffect, useMemo } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { createNode } from "../../lib/nodeFactory";
import {
  Folder,
  ChevronDown,
  FileText,
  LayoutGrid,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { KindList } from "../kinds/KindList";
import { FloatingExplorer } from "./FloatingExplorer";
import { cn } from "../../lib/utils";

export const FloatingIsland: React.FC = () => {
  const workspaceMeta = useGraphStore((state) => state.workspaceMeta);
  const appLifecycle = useGraphStore((state) => state.appLifecycle);
  const nodes = useGraphStore((state) => state.nodes);

  const activeViewMode = useUIStore((state) => state.activeViewMode);
  const setActiveViewMode = useUIStore((state) => state.setActiveViewMode);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);
  const isInspectorOpen = useUIStore((state) => state.isInspectorOpen);
  const toggleInspector = useUIStore((state) => state.toggleInspector);

  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  // Close create menu on click outside
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

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K opens explorer search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsExplorerOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        toggleInspector();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleInspector]);

  const currentWorkspaceName = useMemo(() => {
    if (workspaceMeta?.name) return workspaceMeta.name;
    if (appLifecycle.status === "READY" || appLifecycle.status === "LOADING_WORKSPACE") {
      const parts = (appLifecycle.path || "").split(/[\/\\]/);
      const last = parts[parts.length - 1];
      return last ? last.replace(/\.kye$/, "") : "Workspace";
    }
    return "Workspace";
  }, [workspaceMeta, appLifecycle]);

  const nodeCount = Object.keys(nodes).length;

  const handleCreateNewBlock = (kind: string) => {
    setShowCreateMenu(false);
    createNode({ kind });
  };

  return (
    <nav
      aria-label="Main Navigation"
      className="fixed top-3.5 left-1/2 -translate-x-1/2 z-50 flex items-center font-sans select-none"
    >
      <div className="relative flex items-center gap-2 px-2.5 py-1.5 bg-card/90 backdrop-blur-md border border-border/80 shadow-lg rounded-2xl">
        {/* 1. Left Section: Unified Workspace Trigger */}
        <div className="relative">
          <button
            onClick={() => setIsExplorerOpen(!isExplorerOpen)}
            className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[28px]",
              isExplorerOpen
                ? "bg-primary/15 text-primary shadow-2xs"
                : "text-foreground hover:bg-muted/70"
            )}
            title={`Workspace: ${currentWorkspaceName}`}
          >
            <Folder className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate max-w-[180px] leading-normal">{currentWorkspaceName}</span>
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform duration-150 shrink-0",
                isExplorerOpen && "rotate-180 text-primary"
              )}
            />
          </button>
        </div>

        {/* 2. Center Section: Segmented View Mode Switcher */}
        <div className="flex items-center bg-muted/40 p-0.5 rounded-xl border border-border/50">
          <button
            onClick={() => setActiveViewMode("editor")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer leading-normal",
              activeViewMode === "editor"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Document View"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Doc</span>
          </button>

          <button
            onClick={() => setActiveViewMode("graph")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer leading-normal",
              activeViewMode === "graph"
                ? "bg-background text-foreground shadow-2xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="2D Canvas Graph View"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Canvas</span>
          </button>
        </div>

        {/* 3. Right Section: Create + Inspector + Sync Actions */}
        <div className="flex items-center gap-1">
          {/* Create New Block Menu */}
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className={cn(
                "p-1.5 rounded-xl text-foreground/80 hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer",
                showCreateMenu && "bg-primary/20 text-primary"
              )}
              title="Add New Block"
            >
              <Plus className="w-4 h-4" />
            </button>

            {showCreateMenu && (
              <div className="absolute top-10 right-0 w-52 bg-card/95 backdrop-blur-md border border-border/80 shadow-2xl rounded-2xl p-1.5 text-xs z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground border-b border-border/40 mb-1">
                  New Block Type
                </div>
                <KindList
                  kinds={useGraphStore.getState().kinds}
                  onSelect={handleCreateNewBlock}
                  maxHeightClass="max-h-56"
                />
              </div>
            )}
          </div>

          {/* Inspector Toggle Button */}
          <button
            onClick={toggleInspector}
            className={cn(
              "p-1.5 rounded-xl transition-colors cursor-pointer flex items-center justify-center",
              isInspectorOpen
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            )}
            title="Toggle Selection Inspector (Ctrl+I)"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Sync Status Button */}
          <button
            onClick={() => setSyncPanelOpen(true)}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer flex items-center justify-center"
            title={`P2P Sync (${nodeCount} blocks in graph)`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </button>
        </div>
      </div>

      {/* Floating Explorer Popover */}
      <FloatingExplorer
        isOpen={isExplorerOpen}
        onClose={() => setIsExplorerOpen(false)}
        autoFocusSearch={true}
      />
    </nav>
  );
};

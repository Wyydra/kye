import React, { useState, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { WorkspaceList } from "./WorkspaceList";
import { Plus, FolderOpen, LogOut } from "lucide-react";

export const WorkspaceSwitcherModal: React.FC = () => {
  const isOpen = useUIStore((state) => state.isWorkspaceSwitcherOpen);
  const setOpen = useUIStore((state) => state.setWorkspaceSwitcherOpen);
  const setCreateOpen = useUIStore((state) => state.setCreateWorkspaceModalOpen);

  const recentWorkspaces = useGraphStore((state) => state.recentWorkspaces);
  const loadRecentWorkspaces = useGraphStore((state) => state.loadRecentWorkspaces);
  const openWorkspace = useGraphStore((state) => state.openWorkspace);
  const closeWorkspace = useGraphStore((state) => state.closeWorkspace);
  const removeRecentWorkspace = useGraphStore((state) => state.removeRecentWorkspace);
  const togglePinRecentWorkspace = useGraphStore((state) => state.togglePinRecentWorkspace);
  const appLifecycle = useGraphStore((state) => state.appLifecycle);

  const [selectedIndex, setSelectedIndex] = useState(0);

  const currentPath =
    appLifecycle.status === "READY" || appLifecycle.status === "LOADING_WORKSPACE"
      ? appLifecycle.path
      : null;

  useEffect(() => {
    if (isOpen) {
      setSelectedIndex(0);
      loadRecentWorkspaces();
    }
  }, [isOpen, loadRecentWorkspaces]);

  const handleSelect = async (path: string) => {
    if (path === currentPath) {
      setOpen(false);
      return;
    }
    setOpen(false);
    await openWorkspace(path);
  };

  const handleNewWorkspace = () => {
    setOpen(false);
    setCreateOpen(true);
  };

  const handleOpenExisting = async () => {
    try {
      const picked = await kyeService.pickWorkspaceFile();
      if (picked) {
        setOpen(false);
        await openWorkspace(picked);
      }
    } catch (e) {
      console.error("Failed to pick workspace file", e);
    }
  };

  const handleCloseCurrent = async () => {
    setOpen(false);
    await closeWorkspace();
  };

  const handleReveal = async (path: string) => {
    try {
      await kyeService.revealWorkspaceInExplorer(path);
    } catch (err) {
      console.error("Failed to reveal workspace", err);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      size="sm"
      title={<span className="font-semibold text-sm text-foreground">Switch Workspace</span>}
    >
      <div className="space-y-3 font-sans">
        <WorkspaceList
          workspaces={recentWorkspaces}
          currentPath={currentPath}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          onSelect={handleSelect}
          onTogglePin={togglePinRecentWorkspace}
          onReveal={handleReveal}
          onRemove={removeRecentWorkspace}
          maxHeightClass="max-h-60"
          autoFocusSearch
        />

        {/* Global Action Buttons */}
        <div className="pt-2 border-t border-border/40 space-y-1">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5 text-primary" />}
            onClick={handleNewWorkspace}
            className="w-full justify-start text-xs font-normal"
          >
            New Workspace...
          </Button>

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />}
            onClick={handleOpenExisting}
            className="w-full justify-start text-xs font-normal"
          >
            Open Existing...
          </Button>

          {currentPath && (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              onClick={handleCloseCurrent}
              className="w-full justify-start text-xs font-normal"
            >
              Close Current Workspace
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

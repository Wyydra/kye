import React, { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Plus, FolderOpen, Terminal } from "lucide-react";
import { Button } from "../ui/Button";
import { Spinner } from "../ui/Spinner";
import { WorkspaceList } from "./WorkspaceList";

export const WelcomeScreen: React.FC = () => {
  const setCreateOpen = useUIStore((state) => state.setCreateWorkspaceModalOpen);
  const recentWorkspaces = useGraphStore((state) => state.recentWorkspaces);
  const loadRecentWorkspaces = useGraphStore((state) => state.loadRecentWorkspaces);
  const openWorkspace = useGraphStore((state) => state.openWorkspace);
  const removeRecentWorkspace = useGraphStore((state) => state.removeRecentWorkspace);
  const togglePinRecentWorkspace = useGraphStore((state) => state.togglePinRecentWorkspace);

  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    loadRecentWorkspaces();
  }, [loadRecentWorkspaces]);

  const handleOpenExisting = async () => {
    try {
      const picked = await kyeService.pickWorkspaceFile();
      if (picked) {
        setIsOpening(true);
        await openWorkspace(picked);
      }
    } catch (e) {
      console.error("Failed to pick workspace file", e);
      setIsOpening(false);
    }
  };

  const handleSelectWorkspace = async (path: string) => {
    try {
      setIsOpening(true);
      await openWorkspace(path);
    } catch (e) {
      console.error("Failed to open workspace", e);
      setIsOpening(false);
    }
  };

  const handleReveal = async (path: string) => {
    try {
      await kyeService.revealWorkspaceInExplorer(path);
    } catch (err) {
      console.error("Failed to reveal workspace", err);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-sans select-none items-center justify-center p-6">
      {/* Loading Overlay */}
      {isOpening && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
          <Spinner size="md" />
          <span className="text-xs text-muted-foreground font-mono">Opening workspace...</span>
        </div>
      )}

      <div className="w-full max-w-lg space-y-6">
        {/* Minimal Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-4">
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            <span className="font-mono font-bold text-sm tracking-wider">KYE</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => setCreateOpen(true)}
            >
              New
            </Button>

            <Button
              variant="secondary"
              size="sm"
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
              onClick={handleOpenExisting}
            >
              Open
            </Button>
          </div>
        </div>

        {/* Recents List Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Workspaces
            </span>
          </div>

          <WorkspaceList
            workspaces={recentWorkspaces}
            onSelect={handleSelectWorkspace}
            onTogglePin={togglePinRecentWorkspace}
            onReveal={handleReveal}
            onRemove={removeRecentWorkspace}
            emptyAction={
              <Button
                variant="primary"
                size="xs"
                onClick={() => setCreateOpen(true)}
              >
                Create your first workspace
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
};

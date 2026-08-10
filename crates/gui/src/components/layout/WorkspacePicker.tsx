import React, { useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Plus, X, FolderOpen } from "lucide-react";

export const WorkspacePicker: React.FC = () => {
  const isOpen = useUIStore((state) => state.isWorkspacePickerOpen);
  const setOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleOpenExistingFile = async () => {
    setIsProcessing(true);
    try {
      const res = await kyeService.selectWorkspaceFolder();
      if (res) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to open workspace file", e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateNewFile = async () => {
    setIsProcessing(true);
    try {
      const res = await kyeService.createWorkspaceFile();
      if (res) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to create workspace file", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">

        {/* Header */}
        <div className="p-6 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Kye Workspaces</h2>
            <p className="text-xs text-muted-foreground mt-1">Open or create a database file</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Buttons */}
        <div className="p-6 space-y-4">
          <button
            onClick={handleCreateNewFile}
            disabled={isProcessing}
            className="w-full flex items-center gap-4 p-5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 hover:border-primary/40 rounded-2xl transition-all shadow-md group text-left"
          >
            <div className="w-12 h-12 bg-primary text-primary-foreground rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shadow-sm">
              <Plus className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold group-hover:translate-x-0.5 transition-transform">Create New Workspace</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Pick name and location on your computer</p>
            </div>
          </button>

          <button
            onClick={handleOpenExistingFile}
            disabled={isProcessing}
            className="w-full flex items-center gap-4 p-5 bg-muted/40 hover:bg-muted/70 text-foreground border border-border/60 rounded-2xl transition-all shadow-sm group text-left"
          >
            <div className="w-12 h-12 bg-muted-foreground/10 text-muted-foreground rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold group-hover:translate-x-0.5 transition-transform">Open Existing Workspace</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Browse for any database file</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from "react";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Folder, Plus, X, ChevronRight, Loader2, HardDrive, Monitor } from "lucide-react";

export const WorkspacePicker: React.FC = () => {
  const isOpen = useUIStore((state) => state.isWorkspacePickerOpen);
  const setOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  
  const [workspaces, setWorkspaces] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const mobile = /android|iphone|ipad|ipod/.test(userAgent);
    setIsDesktop(!mobile);
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadWorkspaces();
    }
  }, [isOpen]);

  const loadWorkspaces = async () => {
    setLoading(true);
    try {
      const list = await kyeService.listWorkspaces();
      setWorkspaces(list);
    } catch (e) {
      console.error("Failed to list workspaces", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (name: string) => {
    try {
      // The backend now knows its base directory, we just pass the name
      // or we let the backend handle the 'name to path' conversion.
      // Actually, for simplicity, let's have a command that takes just the name.
      await kyeService.selectWorkspaceFolder(name);
      window.location.reload();
    } catch (e) {
      console.error("Failed to select workspace", e);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await kyeService.createWorkspace(newWorkspaceName.trim());
      await kyeService.selectWorkspaceFolder(newWorkspaceName.trim());
      window.location.reload();
    } catch (e) {
      console.error("Failed to create workspace", e);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-background/80 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="w-full max-w-xl bg-card border border-border shadow-2xl rounded-3xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 slide-in-from-bottom-10 duration-500">
        
        {/* Header */}
        <div className="p-8 border-b border-border/50 flex items-center justify-between bg-muted/20">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Workspaces</h2>
            <p className="text-sm text-muted-foreground mt-1">Select or create a new project space</p>
          </div>
          <button 
            onClick={() => setOpen(false)}
            className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Desktop Browse Button */}
        {isDesktop && (
          <div className="px-8 py-4 bg-primary/5 border-b border-border/50">
            <button 
              onClick={async () => {
                const res = await kyeService.selectWorkspaceFolder(); // No name = open dialog
                if (res) window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-bold transition-all border border-primary/20"
            >
              <Monitor className="w-4 h-4" />
              Open any folder from disk...
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Create New Section */}
          <form onSubmit={handleCreate} className="relative">
            <input 
              type="text"
              placeholder="New workspace name..."
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              autoComplete="off"
              spellCheck="false"
              className="w-full pl-12 pr-16 py-4 bg-muted/50 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Plus className="w-5 h-5" />
            </div>
            <button 
              type="submit"
              disabled={!newWorkspaceName.trim() || isCreating}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:opacity-90 disabled:opacity-30 transition-all shadow-lg shadow-primary/20"
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
            </button>
          </form>

          {/* List Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-50 mb-3">
              <HardDrive className="w-3 h-3" />
              <span>Local Projects</span>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary/40" />
                <span className="text-sm font-medium animate-pulse">Scanning storage...</span>
              </div>
            ) : workspaces.length === 0 ? (
              <div className="text-center py-12 bg-muted/20 rounded-2xl border border-dashed border-border">
                <Folder className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No workspaces found in Documents/Kye</p>
              </div>
            ) : (
              <div className="grid gap-2">
                {workspaces.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSelect(name)}
                    className="group flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/10 transition-all text-left"
                  >
                    <div className="w-12 h-12 bg-muted group-hover:bg-primary/10 rounded-xl flex items-center justify-center transition-colors">
                      <Folder className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold truncate group-hover:text-primary transition-colors">{name}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Kye Workspace</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="p-6 bg-muted/30 border-t border-border/50 text-[10px] text-center text-muted-foreground/60 italic">
          Files are stored in your device's Documents/Kye/ directory.
        </div>
      </div>
    </div>
  );
};

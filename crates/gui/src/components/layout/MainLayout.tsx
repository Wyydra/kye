import { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { kyeService } from "../../services/kyeService";
import { WorkspaceMeta } from "../../types/domain";
import { WorldCanvas } from "../renderers/layouts/WorldCanvas";

export const MainLayout: React.FC = () => {
  const { isLoaded, loadGraph, error } = useGraphStore();
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);

  useEffect(() => {
    kyeService.getMeta().then(setMeta).catch(console.error);
    loadGraph();
  }, [loadGraph]);

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

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Universal World Canvas */}
      <div className="flex-1 h-full relative">
        <WorldCanvas />
      </div>
    </div>
  );
};

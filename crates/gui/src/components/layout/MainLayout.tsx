import { useEffect, useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { NodeRenderer } from "../renderers/NodeRenderer";
import { kyeService } from "../../services/kyeService";
import { FileText, Plus, Trash2 } from "lucide-react";
import { WorkspaceMeta } from "../../types/domain";
import { execute } from "../../lib/commands";

export const MainLayout: React.FC = () => {
  const { isLoaded, loadGraph, error, roots, nodes } = useGraphStore();
  const { activePageId, setActivePage } = useUIStore();
  const [meta, setMeta] = useState<WorkspaceMeta | null>(null);

  useEffect(() => {
    kyeService.getMeta().then(setMeta).catch(console.error);
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (roots.length > 0 && !activePageId) {
      setActivePage(roots[0]);
    }
  }, [roots, activePageId, setActivePage]);

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
      {/* Sidebar */}
      <div className="w-64 border-r border-border bg-muted/20 flex flex-col">
        <div className="p-4 border-b border-border/50">
          <h1 className="font-semibold text-sm truncate">
            {meta?.name || "Kye Workspace"}
          </h1>
        </div>
        <div className="p-2 flex-1 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2 mt-4">
            Pages
          </div>
          <div className="space-y-0.5">
            {roots.map((id) => {
              const node = nodes[id];
              const titleProp = node?.props["title"];
              const title = titleProp?.t === "Text" ? titleProp.v : "Untitled";
              const isActive = activePageId === id;

              return (
                <div key={id} className="group relative">
                  <button
                    onClick={() => setActivePage(id)}
                    className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors flex items-center gap-2 ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/80 hover:bg-muted/50"
                    }`}
                  >
                    <FileText className="w-4 h-4 opacity-70" />
                    <span className="truncate pr-6">{title}</span>
                  </button>

                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm(`Delete "${title}"?`)) {
                        await execute({
                          type: "delete_node",
                          id,
                          cascade: true,
                        });
                        if (isActive) setActivePage(null);
                      }
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                    title="Delete page"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Create Button at the bottom of sidebar */}
        <div className="p-4 mt-auto border-t border-border/50">
          <button
            onClick={async () => {
              const id = crypto.randomUUID();
              await execute({
                type: "create_node",
                id,
                kind: "core.page",
                parent_id: null,
                index: roots.length,
                props: {
                  title: { t: "Text", v: "New Page" },
                },
              });
              setActivePage(id);
            }}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" /> New Page
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-y-auto relative">
        {activePageId ? (
          <NodeRenderer nodeId={activePageId} />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground flex-col gap-2">
            <span className="text-4xl opacity-20 text-foreground">📄</span>
            <p>Select a page or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
};

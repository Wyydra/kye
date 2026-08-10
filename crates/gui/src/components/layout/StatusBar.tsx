import React from "react";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { val } from "../../types/domain";
import { Terminal, Database } from "lucide-react";

/* --- Factorized UI Building Blocks for StatusBar --- */

const StatusBarContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <footer className="h-6 bg-muted/40 border-t border-border/60 flex items-center justify-between px-3 text-[11px] font-mono text-muted-foreground select-none shrink-0">
    {children}
  </footer>
);

const StatusBarBreadcrumb: React.FC<{ title: string; kind?: string }> = ({ title, kind }) => (
  <div className="flex items-center gap-2 overflow-hidden">
    <div className="flex items-center gap-1.5 truncate text-foreground/80">
      <Terminal className="w-3 h-3 text-primary/70 shrink-0" />
      <span className="truncate font-semibold">{title}</span>
      {kind && (
        <span className="text-[10px] text-muted-foreground/60">
          [{kind}]
        </span>
      )}
    </div>
  </div>
);

const StatusBarMetricsGroup: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-3">
    {children}
  </div>
);

const StatusBarMetricItem: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div className="flex items-center gap-1 text-muted-foreground">
    {icon}
    <span>{label}</span>
  </div>
);

/* --- Main Functional Component (0 Raw CSS Strings in JSX) --- */

export const StatusBar: React.FC = () => {
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);

  const nodes = useGraphStore((state) => state.nodes);
  const nodeCount = Object.keys(nodes).length;

  const activeNode = selectedNodeId ? nodes[selectedNodeId] : undefined;
  const activeTitle = val<string>(activeNode?.props["title"]) || (activeNode ? activeNode.kind : "no buffer");

  return (
    <StatusBarContainer>
      <StatusBarBreadcrumb title={activeTitle} kind={activeNode?.kind} />

      <StatusBarMetricsGroup>
        <StatusBarMetricItem icon={<Database className="w-3 h-3" />} label={`${nodeCount}◆ nodes`} />
        <span className="text-muted-foreground/40 hidden sm:inline">UTF-8</span>
      </StatusBarMetricsGroup>
    </StatusBarContainer>
  );
};

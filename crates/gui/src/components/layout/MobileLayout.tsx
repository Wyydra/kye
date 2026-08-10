import React, { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { useCanvasStore } from "../../store/canvasStore";
import { val } from "../../types/domain";
import { execute } from "../../lib/commands";
import { DocumentSurface } from "../renderers/surfaces/DocumentSurface";
import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import {
  FileText,
  HelpCircle,
  Plus,
  FolderOpen,
  ArrowLeft,
  Trash2,
  Search,
  CheckSquare,
  Map,
  List,
  Terminal,
} from "lucide-react";

import { InboxQuickCapture } from "./InboxQuickCapture";
import { VStack, HStack } from "../ui/LayoutPrimitives";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/utils";

/* --- Factorized Subcomponents for MobileLayout --- */

const MobileHeaderContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <header
    className="px-4 py-3 border-b border-border/60 bg-muted/20 shrink-0 flex items-center justify-between font-mono select-none"
    style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
  >
    {children}
  </header>
);

const MobileCardItem: React.FC<{
  title: string;
  kind: string;
  onClick: () => void;
}> = ({ title, kind, onClick }) => (
  <Card interactive onClick={onClick} className="font-mono">
    <HStack gap="sm">
      <FileText className="w-4 h-4 text-primary/80 shrink-0" />
      <VStack gap="none" className="flex-1 min-w-0">
        <span className="text-xs font-bold text-foreground truncate">{title}</span>
        <span className="text-[10px] text-muted-foreground/70 uppercase">[{kind}]</span>
      </VStack>
    </HStack>
  </Card>
);

/* --- Main MobileLayout Component (0 Raw CSS Strings in Main JSX) --- */

export const MobileLayout: React.FC = () => {
  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);

  const openBuffer = useUIStore((state) => state.openBuffer);
  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);

  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useCanvasStore((state) => state.setSelectedNodeId);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "canvas">("list");

  const activeNode = selectedNodeId ? nodes[selectedNodeId] : null;

  const handleCreateNode = (kind: string) => {
    const newId = crypto.randomUUID();
    let props: Record<string, any> = {};

    if (kind === "core.page") {
      props = {
        title: { t: "Text", v: "Untitled Page" },
      };
    } else if (kind === "core.flashcard") {
      props = {
        front: { t: "Rich", v: { spans: [] } },
        back: { t: "Rich", v: { spans: [] } },
      };
    } else if (kind === "core.task") {
      props = {
        title: { t: "Rich", v: { spans: [] } },
        checked: { t: "Bool", v: false },
      };
    }

    execute({
      type: "create_node",
      id: newId,
      kind,
      parent_id: null,
      index: roots.length,
      props,
    });

    openBuffer(newId);
    setShowCreateMenu(false);
  };

  const handleDeleteActiveNode = () => {
    if (!selectedNodeId) return;
    if (window.confirm("Are you sure you want to delete this document?")) {
      execute({
        type: "delete_node",
        id: selectedNodeId,
        cascade: true,
      });
      setSelectedNodeId(null);
    }
  };

  const filteredRoots = roots.filter((id) => {
    const node = nodes[id];
    if (!node || node.kind === "core.connection") return false;

    const title =
      val<string>(node.props.title) ||
      (node.kind === "core.flashcard" ? "Flashcard" : "Untitled");

    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (activeNode) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden font-mono">
        <MobileHeaderContainer>
          <button
            onClick={() => setSelectedNodeId(null)}
            className="flex items-center gap-1 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold">Back</span>
          </button>

          <Badge variant="muted" className="text-[10px]">
            [{activeNode.kind}]
          </Badge>

          <button
            onClick={handleDeleteActiveNode}
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </MobileHeaderContainer>

        <div className="flex-1 overflow-y-auto p-4">
          <DocumentSurface node={activeNode} depth={0} layout={{ t: "VerticalStream" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden relative font-mono select-none">
      <MobileHeaderContainer>
        <HStack gap="xs" align="center">
          <Terminal className="w-4 h-4 text-primary" />
          <span className="font-extrabold text-xs tracking-tight">KYE_MOBILE</span>
        </HStack>

        <HStack gap="xs" align="center">
          <button
            onClick={() => setActiveTab(activeTab === "list" ? "canvas" : "list")}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 cursor-pointer"
          >
            {activeTab === "list" ? <Map className="w-3.5 h-3.5" /> : <List className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-semibold">{activeTab === "list" ? "Canvas" : "List"}</span>
          </button>

          <button
            onClick={() => setWorkspacePickerOpen(true)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="text-[11px] font-semibold">Dir</span>
          </button>
        </HStack>
      </MobileHeaderContainer>

      {activeTab === "canvas" ? (
        <div className="flex-1 w-full h-full relative overflow-hidden">
          <CanvasLayout />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
          <div className="relative">
            <input
              type="text"
              placeholder="Search buffers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary transition-all text-xs font-mono"
            />
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          {searchQuery === "" && <InboxQuickCapture />}

          <VStack gap="xs">
            {filteredRoots.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-border/60 rounded-lg text-muted-foreground/60 text-xs italic">
                [NO BUFFERS FOUND]
              </div>
            ) : (
              filteredRoots.map((id) => {
                const node = nodes[id];
                const title =
                  val<string>(node.props.title) ||
                  (node.kind === "core.flashcard" ? "Flashcard" : "Untitled");

                return (
                  <MobileCardItem
                    key={id}
                    title={title}
                    kind={node.kind}
                    onClick={() => openBuffer(id)}
                  />
                );
              })
            )}
          </VStack>
        </div>
      )}

      {/* Floating Action Button (FAB) Creation Menu */}
      {activeTab === "list" && (
        <div
          className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2"
          style={{ bottom: "calc(1.5rem + var(--safe-bottom))", right: "calc(1.5rem + var(--safe-right))" }}
        >
          {showCreateMenu && (
            <VStack gap="xs" className="p-1 bg-popover border border-border/70 rounded-xl shadow-xl font-mono text-xs">
              <button
                onClick={() => handleCreateNode("core.page")}
                className="flex items-center gap-2 px-3 py-1.5 text-foreground hover:bg-muted rounded-lg transition-all cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-blue-400" />
                <span>Create Page</span>
              </button>
              <button
                onClick={() => handleCreateNode("core.flashcard")}
                className="flex items-center gap-2 px-3 py-1.5 text-foreground hover:bg-muted rounded-lg transition-all cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-indigo-400" />
                <span>Create Flashcard</span>
              </button>
              <button
                onClick={() => handleCreateNode("core.task")}
                className="flex items-center gap-2 px-3 py-1.5 text-foreground hover:bg-muted rounded-lg transition-all cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Create Task List</span>
              </button>
            </VStack>
          )}

          <button
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className={cn(
              "w-12 h-12 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 cursor-pointer",
              showCreateMenu && "rotate-45"
            )}
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {activeTab === "list" && showCreateMenu && (
        <div
          onClick={() => setShowCreateMenu(false)}
          className="fixed inset-0 z-40 bg-transparent"
        />
      )}
    </div>
  );
};

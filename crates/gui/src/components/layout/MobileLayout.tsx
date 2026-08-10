import React, { useState } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { val } from "../../types/domain";
import { execute } from "../../lib/commands";
import { DocumentSurface } from "../renderers/surfaces/DocumentSurface";
import { CanvasLayout } from "../renderers/layouts/CanvasLayout";
import { 
  FileText, 
  HelpCircle, 
  Image as ImageIcon, 
  Plus, 
  FolderOpen, 
  ArrowLeft, 
  Trash2, 
  Search, 
  CheckSquare,
  Map,
  List,
  Network
} from "lucide-react";

import { InboxQuickCapture } from "./InboxQuickCapture";

export const MobileLayout: React.FC = () => {
  // ...
  // inside component:
  // ...
  // <DocumentSurface node={activeNode} depth={0} layout={{ t: "VerticalStream" }} />
  const roots = useGraphStore((state) => state.roots);
  const nodes = useGraphStore((state) => state.nodes);
  const setWorkspacePickerOpen = useUIStore((state) => state.setWorkspacePickerOpen);
  const setSyncPanelOpen = useUIStore((state) => state.setSyncPanelOpen);

  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"list" | "canvas">("list");

  const activeNode = activeNodeId ? nodes[activeNodeId] : null;

  const handleCreateNode = (kind: string) => {
    const newId = crypto.randomUUID();
    let props: Record<string, any> = {};
    
    if (kind === "core.page") {
      props = { 
        title: { t: "Text", v: "Untitled Page" } 
      };
    } else if (kind === "core.flashcard") {
      props = {
        front: { t: "Rich", v: { spans: [] } },
        back: { t: "Rich", v: { spans: [] } }
      };
    } else if (kind === "core.task") {
      props = {
        title: { t: "Rich", v: { spans: [] } },
        checked: { t: "Bool", v: false }
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
    
    setActiveNodeId(newId);
    setShowCreateMenu(false);
  };

  const handleDeleteActiveNode = () => {
    if (!activeNodeId) return;
    if (window.confirm("Are you sure you want to delete this document?")) {
      execute({
        type: "delete_node",
        id: activeNodeId,
        cascade: true,
      });
      setActiveNodeId(null);
    }
  };

  // Filter root nodes by search query and kind (only show document/renderable roots, skip connections)
  const filteredRoots = roots.filter((id) => {
    const node = nodes[id];
    if (!node || node.kind === "core.connection") return false;
    
    const title = val<string>(node.props.title) || 
                  (node.kind === "core.flashcard" ? "Flashcard" : "Untitled");
                  
    return title.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getIcon = (kind: string) => {
    switch (kind) {
      case "core.flashcard":
        return <HelpCircle className="w-5 h-5 text-indigo-500" />;
      case "core.image":
        return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      case "core.task":
        return <CheckSquare className="w-5 h-5 text-amber-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  const getKindLabel = (kind: string) => {
    return kind.split(".").pop() || kind;
  };

  if (activeNode) {
    return (
      <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden">
        {/* Editor Header with Safe Area */}
        <div 
          className="flex items-center justify-between border-b border-border bg-secondary/30 px-4 py-3 shrink-0"
          style={{ paddingTop: "calc(0.75rem + var(--safe-top))" }}
        >
          <button 
            onClick={() => setActiveNodeId(null)}
            className="flex items-center gap-1.5 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-semibold">Back</span>
          </button>
          
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
            {getKindLabel(activeNode.kind)}
          </span>

          <button 
            onClick={handleDeleteActiveNode}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-y-auto pb-safe-bottom">
          <DocumentSurface node={activeNode} depth={0} layout={{ t: "VerticalStream" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-foreground overflow-hidden relative">
      {/* List Header with Safe Area */}
      <div 
        className="px-6 py-4 border-b border-border bg-secondary/30 shrink-0 flex items-center justify-between"
        style={{ paddingTop: "calc(1.25rem + var(--safe-top))" }}
      >
        <div className="flex items-center gap-2 select-none">
          <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-sm font-black text-primary-foreground italic">K</span>
          </div>
          <span className="font-extrabold text-base tracking-tight">Kye Mobile</span>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setActiveTab(activeTab === "list" ? "canvas" : "list")}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
          >
            {activeTab === "list" ? <Map className="w-4 h-4" /> : <List className="w-4 h-4" />}
            <span className="text-xs font-semibold">{activeTab === "list" ? "Canvas" : "List"}</span>
          </button>

          <button 
            onClick={() => setSyncPanelOpen(true)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
          >
            <Network className="w-4 h-4" />
            <span className="text-xs font-semibold">Sync</span>
          </button>

          <button 
            onClick={() => setWorkspacePickerOpen(true)}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5"
          >
            <FolderOpen className="w-4 h-4" />
            <span className="text-xs font-semibold">Workspaces</span>
          </button>
        </div>
      </div>

      {activeTab === "canvas" ? (
        <div className="flex-1 w-full h-full relative overflow-hidden">
          <CanvasLayout />
        </div>
      ) : (
        /* Search and List Container */
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 pb-24">
          {/* Search Input */}
          <div className="relative">
            <input 
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-sm"
            />
            <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          </div>

          {searchQuery === "" && <InboxQuickCapture />}

          {/* Document List */}
          <div className="space-y-2">
            {filteredRoots.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/10 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto opacity-20 mb-3" />
                <p className="text-sm">No documents found</p>
              </div>
            ) : (
              filteredRoots.map((id) => {
                const node = nodes[id];
                const title = val<string>(node.props.title) || 
                              (node.kind === "core.flashcard" ? "Flashcard" : "Untitled");
                
                return (
                  <button
                    key={id}
                    onClick={() => setActiveNodeId(id)}
                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/30 transition-all text-left shadow-xs active:scale-[0.99]"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {getIcon(node.kind)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{title}</h3>
                      <p className="text-[10px] text-muted-foreground/80 mt-0.5 uppercase tracking-wider font-semibold">
                        {getKindLabel(node.kind)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Floating Action Button (FAB) & Bottom Sheet Creation Menu */}
      {activeTab === "list" && (
        <div 
          className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          style={{ bottom: "calc(1.5rem + var(--safe-bottom))", right: "calc(1.5rem + var(--safe-right))" }}
        >
          {showCreateMenu && (
            <div className="flex flex-col gap-2 p-2 bg-popover border border-border rounded-2xl shadow-xl animate-in slide-in-from-bottom-5 fade-in duration-200">
              <button 
                onClick={() => handleCreateNode("core.page")}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-xl transition-all"
              >
                <FileText className="w-4 h-4 text-blue-500" />
                <span>Create Page</span>
              </button>
              <button 
                onClick={() => handleCreateNode("core.flashcard")}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-xl transition-all"
              >
                <HelpCircle className="w-4 h-4 text-indigo-500" />
                <span>Create Flashcard</span>
              </button>
              <button 
                onClick={() => handleCreateNode("core.task")}
                className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted rounded-xl transition-all"
              >
                <CheckSquare className="w-4 h-4 text-amber-500" />
                <span>Create Task List</span>
              </button>
            </div>
          )}

          <button 
            onClick={() => setShowCreateMenu(!showCreateMenu)}
            className={`w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 ${
              showCreateMenu ? "rotate-45" : ""
            } hover:scale-105 active:scale-95`}
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>
      )}
      
      {/* Tap backdrop to close creation menu */}
      {activeTab === "list" && showCreateMenu && (
        <div 
          onClick={() => setShowCreateMenu(false)}
          className="fixed inset-0 z-40 bg-transparent"
        />
      )}
    </div>
  );
};

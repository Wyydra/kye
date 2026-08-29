import React, { useMemo } from "react";
import { useUIStore } from "../../store/uiStore";
import { useGraphStore } from "../../store/graphStore";
import { useCanvasStore } from "../../store/canvasStore";
import { execute } from "../../lib/commands";
import { extractTextFromValue, val } from "../../types/domain";
import { KindIcon } from "../kinds/KindIcon";
import { KindList } from "../kinds/KindList";
import {
  X,
  Indent,
  Outdent,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  ChevronRight,
  SlidersHorizontal,
  FolderTree,
  Lock,
  Unlock,
} from "lucide-react";
import { cn } from "../../lib/utils";

export const BlockInspectorPanel: React.FC = () => {
  const isInspectorOpen = useUIStore((state) => state.isInspectorOpen);
  const setInspectorOpen = useUIStore((state) => state.setInspectorOpen);
  const focusedNodeId = useUIStore((state) => state.focusedNodeId);
  const selectedNodeId = useCanvasStore((state) => state.selectedNodeId);

  const nodes = useGraphStore((state) => state.nodes);
  const kinds = useGraphStore((state) => state.kinds);

  const [showKindPicker, setShowKindPicker] = React.useState(false);

  // Active target block
  const activeNodeId = focusedNodeId || selectedNodeId || null;
  const activeNode = activeNodeId ? nodes[activeNodeId] : null;
  const kindDef = activeNode ? kinds[activeNode.kind] : null;

  // Compute Ancestor Breadcrumbs
  const breadcrumbs = useMemo(() => {
    if (!activeNode) return [];
    const chain: { id: string; title: string; kind: string }[] = [];
    let curr: string | undefined = activeNode.parent || undefined;

    while (curr) {
      const pNode = nodes[curr];
      if (!pNode) break;
      const title =
        extractTextFromValue(pNode.props.title) ||
        extractTextFromValue(pNode.props.body) ||
        pNode.kind.replace("core.", "");
      chain.unshift({ id: pNode.id, title: title.slice(0, 20), kind: pNode.kind });
      curr = pNode.parent || undefined;
    }
    return chain;
  }, [activeNode, nodes]);

  if (!isInspectorOpen) return null;

  const parentNode = activeNode?.parent ? nodes[activeNode.parent] : null;
  const siblingIndex = parentNode && activeNode ? parentNode.children.indexOf(activeNode.id) : -1;
  const childrenCount = activeNode?.children?.length || 0;
  const isCollapsed = !!val<boolean>(activeNode?.props.is_collapsed);

  // Actions
  const handleIndent = () => {
    if (!activeNode || !parentNode || siblingIndex <= 0) return;
    const prevSiblingId = parentNode.children[siblingIndex - 1];
    const prevSibling = nodes[prevSiblingId];
    if (prevSibling) {
      execute({
        type: "move_node",
        node_id: activeNode.id,
        new_parent_id: prevSiblingId,
        new_index: prevSibling.children.length,
      });
    }
  };

  const handleOutdent = () => {
    if (!activeNode || !parentNode || !parentNode.parent) return;
    const grandParent = nodes[parentNode.parent];
    if (grandParent) {
      const parentIndex = grandParent.children.indexOf(parentNode.id);
      execute({
        type: "move_node",
        node_id: activeNode.id,
        new_parent_id: parentNode.parent,
        new_index: parentIndex + 1,
      });
    }
  };

  const handleMoveUp = () => {
    if (!activeNode || !parentNode || siblingIndex <= 0) return;
    execute({
      type: "move_node",
      node_id: activeNode.id,
      new_parent_id: activeNode.parent,
      new_index: siblingIndex - 1,
    });
  };

  const handleMoveDown = () => {
    if (!activeNode || !parentNode || siblingIndex >= parentNode.children.length - 1) return;
    execute({
      type: "move_node",
      node_id: activeNode.id,
      new_parent_id: activeNode.parent,
      new_index: siblingIndex + 1,
    });
  };

  const handleDuplicate = () => {
    if (!activeNode || !parentNode) return;
    const newId = crypto.randomUUID();
    execute({
      type: "create_node",
      id: newId,
      kind: activeNode.kind,
      parent_id: activeNode.parent,
      index: siblingIndex + 1,
      props: { ...activeNode.props },
    });
    useUIStore.getState().setFocusedNode(newId);
  };

  const handleDelete = () => {
    if (!activeNode) return;
    execute({ type: "delete_node", id: activeNode.id, cascade: true });
    useUIStore.getState().setFocusedNode(null);
  };

  const handleToggleCollapse = () => {
    if (!activeNode) return;
    execute({
      type: "set_prop",
      node_id: activeNode.id,
      key: "is_collapsed",
      value: { t: "Bool", v: !isCollapsed },
    });
  };

  const handleConvertKind = (newKind: string) => {
    if (!activeNode) return;
    setShowKindPicker(false);
    execute({
      type: "set_kind",
      node_id: activeNode.id,
      new_kind: newKind,
    });
  };

  const isLocked = !!val<boolean>(activeNode?.props.is_locked);
  const handleToggleLock = () => {
    if (!activeNode) return;
    execute({
      type: "set_prop",
      node_id: activeNode.id,
      key: "is_locked",
      value: { t: "Bool", v: !isLocked },
    });
  };

  return (
    <aside
      aria-label="Selection Inspector"
      className="w-72 h-full bg-card/95 backdrop-blur-md border-l border-border/80 flex flex-col font-sans select-none z-40 shadow-xl animate-in slide-in-from-right-4 duration-150"
    >
      {/* 1. Header */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Inspector
          </span>
        </div>
        <button
          onClick={() => setInspectorOpen(false)}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
          title="Close inspector"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Content */}
      {!activeNode ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground/60 gap-2">
          <FolderTree className="w-8 h-8 opacity-40" />
          <span className="text-xs font-medium">No block selected</span>
          <span className="text-[11px] text-muted-foreground/40">
            Click any block in the document or canvas to inspect its structure.
          </span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-xs">
          {/* Breadcrumbs Path */}
          {breadcrumbs.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 text-[11px] text-muted-foreground/70 pb-2 border-b border-border/40">
              {breadcrumbs.map((b) => (
                <React.Fragment key={b.id}>
                  <span
                    onClick={() => useUIStore.getState().setFocusedNode(b.id)}
                    className="hover:text-primary cursor-pointer truncate max-w-[90px]"
                    title={b.title}
                  >
                    {b.title}
                  </span>
                  <ChevronRight className="w-2.5 h-2.5 shrink-0 opacity-50" />
                </React.Fragment>
              ))}
              <span className="font-semibold text-foreground truncate max-w-[100px]">
                {extractTextFromValue(activeNode.props.title) || activeNode.kind.replace("core.", "")}
              </span>
            </div>
          )}

          {/* Type Switcher Card */}
          <div className="relative p-2.5 bg-muted/30 border border-border/60 rounded-xl space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider">
              Block Type
            </div>
            <button
              onClick={() => setShowKindPicker(!showKindPicker)}
              className="w-full flex items-center justify-between p-2 rounded-lg bg-card border border-border/70 hover:border-primary/50 text-foreground transition-all cursor-pointer font-semibold shadow-2xs"
            >
              <div className="flex items-center gap-2">
                <KindIcon kind={activeNode.kind} kindDef={kindDef || undefined} size={15} />
                <span>{kindDef?.label || activeNode.kind.replace("core.", "")}</span>
              </div>
              <ChevronRight
                className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showKindPicker && "rotate-90")}
              />
            </button>

            {showKindPicker && (
              <div className="pt-2">
                <KindList
                  kinds={kinds}
                  onSelect={handleConvertKind}
                  maxHeightClass="max-h-48"
                />
              </div>
            )}
          </div>

          {/* Quick Structural Actions Cluster */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider">
              Hierarchy Actions
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleIndent}
                disabled={!parentNode || siblingIndex <= 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                title="Indent (Tab)"
              >
                <Indent className="w-3.5 h-3.5 text-primary" />
                <span>Indent</span>
              </button>

              <button
                onClick={handleOutdent}
                disabled={!parentNode?.parent}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                title="Outdent (Shift+Tab)"
              >
                <Outdent className="w-3.5 h-3.5 text-primary" />
                <span>Outdent</span>
              </button>

              <button
                onClick={handleMoveUp}
                disabled={!parentNode || siblingIndex <= 0}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                title="Move Up (Alt+Up)"
              >
                <ArrowUp className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Move Up</span>
              </button>

              <button
                onClick={handleMoveDown}
                disabled={!parentNode || siblingIndex >= (parentNode.children?.length || 1) - 1}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted disabled:opacity-30 text-foreground transition-colors cursor-pointer disabled:cursor-not-allowed text-xs font-medium"
                title="Move Down (Alt+Down)"
              >
                <ArrowDown className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Move Down</span>
              </button>

              <button
                onClick={handleDuplicate}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted text-foreground transition-colors cursor-pointer text-xs font-medium"
                title="Duplicate Block (Ctrl+D)"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Duplicate</span>
              </button>

              <button
                onClick={handleToggleLock}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer text-xs font-medium",
                  isLocked ? "bg-amber-500/15 text-amber-500 hover:bg-amber-500/20" : "bg-muted/40 hover:bg-muted text-foreground"
                )}
                title="Lock / Unlock position"
              >
                {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
                <span>{isLocked ? "Locked" : "Lock"}</span>
              </button>

              {/* Sub-tree Collapse / Expand Button */}
              {childrenCount > 0 && (
                <button
                  onClick={handleToggleCollapse}
                  className="col-span-2 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors cursor-pointer text-xs font-semibold"
                >
                  <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-150", !isCollapsed && "rotate-90")} />
                  <span>{isCollapsed ? `Expand Sub-tree (${childrenCount})` : `Collapse Sub-tree (${childrenCount})`}</span>
                </button>
              )}
            </div>
          </div>

          {/* Dynamic Properties Customizer */}
          <div className="space-y-2 pt-2 border-t border-border/40">
            <div className="text-[10px] font-bold uppercase text-muted-foreground/70 tracking-wider">
              Properties
            </div>

            {/* Heading Level Selector */}
            {activeNode.kind === "core.heading" && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Heading Level</label>
                <div className="flex gap-1">
                  {[1, 2, 3].map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() =>
                        execute({
                          type: "set_prop",
                          node_id: activeNode.id,
                          key: "level",
                          value: { t: "Int", v: lvl },
                        })
                      }
                      className={cn(
                        "flex-1 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer",
                        (val<number>(activeNode.props.level) || 1) === lvl
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card border-border hover:bg-muted text-foreground"
                      )}
                    >
                      H{lvl}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Task Checked Toggle */}
            {activeNode.kind === "core.task" && (
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/60">
                <span className="text-xs text-foreground">Completed</span>
                <input
                  type="checkbox"
                  checked={!!val<boolean>(activeNode.props.checked)}
                  onChange={(e) =>
                    execute({
                      type: "set_prop",
                      node_id: activeNode.id,
                      key: "checked",
                      value: { t: "Bool", v: e.target.checked },
                    })
                  }
                  className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
                />
              </div>
            )}

            {/* Sub-Tree Stats */}
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 space-y-1">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Sub-blocks:</span>
                <span className="font-semibold text-foreground">{childrenCount}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                <span>ID:</span>
                <span className="truncate max-w-[130px] opacity-70">{activeNode.id}</span>
              </div>
            </div>
          </div>

          {/* Delete Danger Zone */}
          <div className="pt-2 border-t border-border/40">
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors font-semibold text-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Block</span>
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};

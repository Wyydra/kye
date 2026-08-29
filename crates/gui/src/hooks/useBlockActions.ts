import { useMemo } from "react";
import { useGraphStore } from "../store/graphStore";
import { useUIStore } from "../store/uiStore";
import { execute } from "../lib/commands";
import { ActionDef, extractTextFromValue } from "../types/domain";
import { executeBlockAction } from "../lib/actionDispatcher";

export function useBlockActions(nodeId: string) {
  const node = useGraphStore((state) => state.nodes[nodeId]);
  const kinds = useGraphStore((state) => state.kinds);
  const openBuffer = useUIStore((state) => state.openBuffer);

  const kindDef = node ? kinds[node.kind] : undefined;

  // Synthesize declared and smart type-specific actions
  const typeActions: ActionDef[] = useMemo(() => {
    if (!node) return [];

    const list: ActionDef[] = [];

    // 1. Actions declared in KindDef schema
    if (kindDef?.view?.actions && kindDef.view.actions.length > 0) {
      list.push(...kindDef.view.actions);
    }

    // 2. Smart built-in actions per kind if not already declared
    if (node.kind === "core.task" && !list.some((a) => a.kind.includes("checked"))) {
      const isChecked = node.props.checked?.t === "Bool" ? (node.props.checked as any).v : false;
      list.push({
        id: "toggle_checked",
        label: isChecked ? "Mark as Incomplete" : "Mark as Completed",
        kind: "toggle_prop:checked",
      });
    }

    if (node.kind === "core.canvas" && !list.some((a) => a.kind === "open_canvas")) {
      list.push({
        id: "open_canvas_surface",
        label: "Open in 2D Whiteboard",
        kind: "open_canvas",
      });
    }

    return list;
  }, [node, kindDef]);

  const duplicateNode = () => {
    if (!node) return;
    const newId = crypto.randomUUID();
    const currentTitle = extractTextFromValue(node.props.title) || "Untitled";
    const duplicateProps = {
      ...node.props,
      title: { t: "Text" as const, v: `${currentTitle} (Copy)` },
    };

    execute({
      type: "create_node",
      id: newId,
      kind: node.kind,
      parent_id: node.parent,
      index: 0,
      props: duplicateProps,
    });
    openBuffer(newId);
  };

  const copyWikiLink = async (): Promise<boolean> => {
    if (!node) return false;
    const title = extractTextFromValue(node.props.title);
    const linkText = title ? `[[${title}]]` : `[[${node.id}]]`;
    try {
      await navigator.clipboard.writeText(linkText);
      return true;
    } catch {
      return false;
    }
  };

  const convertKind = (newKind: string) => {
    if (!node || node.kind === newKind) return;
    execute({
      type: "set_kind",
      node_id: nodeId,
      new_kind: newKind,
    });
  };

  const deleteNode = () => {
    if (!node) return;
    execute({
      type: "delete_node",
      id: nodeId,
      cascade: true,
    });
  };

  const runAction = async (action: ActionDef) => {
    if (!node) return;
    await executeBlockAction(action, { nodeId, node, kindDef });
  };

  return {
    node,
    kindDef,
    typeActions,
    duplicateNode,
    copyWikiLink,
    convertKind,
    deleteNode,
    runAction,
  };
}

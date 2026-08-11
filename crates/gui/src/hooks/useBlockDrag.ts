import { useState, useCallback } from "react";
import { execute } from "../lib/commands";
import { useGraphStore } from "../store/graphStore";
import { Node } from "../types/domain";

export function useBlockDrag(node: Node) {
  const [dragState, setDragState] = useState<"none" | "top" | "bottom">("none");

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("application/kye-node", node.id);
      e.dataTransfer.setData("text/plain", node.id);
    },
    [node.id],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const isTopHalf = e.clientY < rect.top + rect.height / 2;
    setDragState(isTopHalf ? "top" : "bottom");
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState("none");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const isTopHalf = e.clientY < rect.top + rect.height / 2;
      const isBottom = !isTopHalf;

      setDragState("none");

      const sourceId =
        e.dataTransfer.getData("application/kye-node") ||
        e.dataTransfer.getData("text/plain");

      if (!sourceId || sourceId === node.id) return;

      const state = useGraphStore.getState();
      const sourceNode = state.nodes[sourceId];
      if (!sourceNode) return;

      const targetParentNode = state.nodes[node.parent || ""];
      if (!targetParentNode) return;

      const childrenWithoutSource = targetParentNode.children.filter(
        (id) => id !== sourceId,
      );
      const targetIndex = childrenWithoutSource.indexOf(node.id);
      if (targetIndex === -1) return;

      let newIndex = targetIndex;
      if (isBottom) {
        newIndex += 1;
      }

      execute({
        type: "move_node",
        node_id: sourceId,
        new_parent_id: node.parent,
        new_index: newIndex,
      });
    },
    [node.id, node.parent],
  );

  return {
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}


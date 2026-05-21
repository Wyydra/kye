

import { useCallback } from "react";
import { useGraphStore } from "../store/graphStore";
import { useUIStore } from "../store/uiStore";
import { execute } from "../lib/commands";
import { Node } from "../types/domain";

interface Options {
  node: Node;

  nextKind?: string;

  nextProps?: Record<string, any>;
}

export function useBlockKeyDown({ node, nextKind = "core.paragraph", nextProps }: Options) {
  const { setFocusedNode } = useUIStore.getState();

  return useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const graphState = useGraphStore.getState();
      const parentNode = graphState.nodes[node.parent || ""];

      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!parentNode) return;
        const index = parentNode.children.indexOf(node.id);
        const newId = crypto.randomUUID();
        execute({
          type: "create_node",
          id: newId,
          kind: nextKind,
          parent_id: node.parent,
          index: index + 1,
          props: nextProps ?? { body: { t: "Rich", v: { spans: [] } } },
        });
        setFocusedNode(newId);
        return;
      }

      if (
        e.key === "Backspace" &&
        (e.currentTarget.textContent || "").length === 0
      ) {
        e.preventDefault();
        if (!parentNode) return;
        const index = parentNode.children.indexOf(node.id);
        if (index > 0) {
          const prevId = parentNode.children[index - 1];
          execute({ type: "delete_node", id: node.id, cascade: true });
          setFocusedNode(prevId);
        }
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (!parentNode) return;
        const index = parentNode.children.indexOf(node.id);

        if (e.shiftKey) {

          if (parentNode.parent) {
            const grandParent = graphState.nodes[parentNode.parent];
            if (grandParent) {
              const parentIndex = grandParent.children.indexOf(parentNode.id);
              execute({
                type: "move_node",
                node_id: node.id,
                new_parent_id: parentNode.parent,
                new_index: parentIndex + 1,
              });
              setFocusedNode(node.id);
            }
          }
        } else {

          if (index > 0) {
            const prevSiblingId = parentNode.children[index - 1];
            const prevSibling = graphState.nodes[prevSiblingId];
            if (prevSibling) {
              execute({
                type: "move_node",
                node_id: node.id,
                new_parent_id: prevSiblingId,
                new_index: prevSibling.children.length,
              });
              setFocusedNode(node.id);
            }
          }
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        const index = parentNode?.children.indexOf(node.id) ?? -1;

        if (index > 0) {

          let targetId = parentNode!.children[index - 1];
          let targetNode = graphState.nodes[targetId];
          while (targetNode && targetNode.children.length > 0) {
            targetId = targetNode.children[targetNode.children.length - 1];
            targetNode = graphState.nodes[targetId];
          }
          setFocusedNode(targetId);
        } else if (node.parent) {

          setFocusedNode(node.parent);
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();

        if (node.children.length > 0) {

          setFocusedNode(node.children[0]);
        } else {

          let currentId = node.id;
          let currentParent = parentNode;

          while (currentParent) {
            const idx = currentParent.children.indexOf(currentId);
            if (idx < currentParent.children.length - 1) {
              setFocusedNode(currentParent.children[idx + 1]);
              return;
            }

            currentId = currentParent.id;
            currentParent = graphState.nodes[currentParent.parent || ""];
          }
        }
        return;
      }
    },
    [node, nextKind, nextProps, setFocusedNode],
  );
}

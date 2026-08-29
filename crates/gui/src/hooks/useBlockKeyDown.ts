import { useCallback } from "react";
import { useGraphStore } from "../store/graphStore";
import { useUIStore } from "../store/uiStore";
import { execute } from "../lib/commands";
import { Node, extractTextFromValue } from "../types/domain";

interface Options {
  node: Node;
  nextKind?: string;
  nextProps?: Record<string, any>;
}

export function useBlockKeyDown({ node, nextKind = "core.paragraph", nextProps }: Options) {
  const { setFocusedNode } = useUIStore.getState();

  return useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      const graphState = useGraphStore.getState();
      const parentNode = graphState.nodes[node.parent || ""];
      if (!parentNode) return;

      const index = parentNode.children.indexOf(node.id);

      // --- 1. Tab & Shift+Tab (Notion Universal Indent / Outdent) ---
      if (e.key === "Tab") {
        e.preventDefault();
        e.stopPropagation();

        if (e.shiftKey) {
          // Outdent (Shift+Tab): Move to grandparent
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
          // Indent (Tab): Move under previous sibling
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

      // --- 2. Enter (Notion Split & Flow into Paragraph) ---
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();

        const sel = window.getSelection();
        let splitTextAfter = "";

        if (sel && sel.anchorNode) {
          const rawText = sel.anchorNode.textContent || "";
          const offset = sel.anchorOffset;

          if (offset < rawText.length) {
            const textBefore = rawText.slice(0, offset);
            splitTextAfter = rawText.slice(offset);

            // Update current block with the first half of text
            execute({
              type: "set_prop",
              node_id: node.id,
              key: "body",
              value: { t: "Rich", v: { spans: [{ text: textBefore, marks: [] }] } },
            });
          }
        }

        const newId = crypto.randomUUID();
        // Headings always spawn normal paragraphs below!
        const targetNextKind = node.kind === "core.heading" ? "core.paragraph" : nextKind;
        const initialBody = splitTextAfter ? { spans: [{ text: splitTextAfter, marks: [] }] } : { spans: [] };

        execute({
          type: "create_node",
          id: newId,
          kind: targetNextKind,
          parent_id: node.parent,
          index: index + 1,
          props: nextProps ?? { body: { t: "Rich", v: initialBody } },
        });
        setFocusedNode(newId);
        return;
      }

      // --- 3. Backspace (Notion Merge / Outdent / Delete) ---
      if (e.key === "Backspace") {
        const textTarget = e.target as HTMLElement;
        const textContent = textTarget?.textContent || "";
        const sel = window.getSelection();
        const isAtStart = !sel || sel.anchorOffset === 0;

        if (textContent.length === 0) {
          e.preventDefault();
          e.stopPropagation();

          // If indented under a parent (depth > 0), outdent first
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
              return;
            }
          }

          // Otherwise delete empty block and focus previous sibling or parent
          if (index > 0) {
            const prevId = parentNode.children[index - 1];
            execute({ type: "delete_node", id: node.id, cascade: true });
            setFocusedNode(prevId);
          } else if (node.parent) {
            execute({ type: "delete_node", id: node.id, cascade: true });
            setFocusedNode(node.parent);
          }
          return;
        } else if (isAtStart && index > 0) {
          // Merge with previous block if cursor is at the very beginning
          const prevId = parentNode.children[index - 1];
          const prevNode = graphState.nodes[prevId];

          if (prevNode && prevNode.kind === "core.paragraph" && node.kind === "core.paragraph") {
            e.preventDefault();
            e.stopPropagation();

            const prevText = extractTextFromValue(prevNode.props.body) || "";
            const currentText = extractTextFromValue(node.props.body) || "";
            const mergedText = prevText + currentText;

            execute({
              type: "set_prop",
              node_id: prevId,
              key: "body",
              value: { t: "Rich", v: { spans: [{ text: mergedText, marks: [] }] } },
            });

            execute({ type: "delete_node", id: node.id, cascade: true });
            setFocusedNode(prevId);
            return;
          }
        }
      }

      // --- 4. Arrow Up & Down Navigation ---
      if (e.key === "ArrowUp") {
        const sel = window.getSelection();
        const isAtFirstLine = !sel || sel.anchorOffset === 0;

        if (isAtFirstLine) {
          if (index > 0) {
            e.preventDefault();
            e.stopPropagation();
            let targetId = parentNode.children[index - 1];
            let targetNode = graphState.nodes[targetId];
            while (targetNode && targetNode.children.length > 0) {
              targetId = targetNode.children[targetNode.children.length - 1];
              targetNode = graphState.nodes[targetId];
            }
            setFocusedNode(targetId);
          } else if (node.parent) {
            e.preventDefault();
            e.stopPropagation();
            setFocusedNode(node.parent);
          }
        }
        return;
      }

      if (e.key === "ArrowDown") {
        const sel = window.getSelection();
        const isAtLastLine = !sel || sel.anchorOffset === (sel.anchorNode?.textContent?.length || 0);

        if (isAtLastLine) {
          if (node.children.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            setFocusedNode(node.children[0]);
          } else {
            let currentId = node.id;
            let currentParent: Node | undefined = parentNode;

            while (currentParent) {
              const idx = currentParent.children.indexOf(currentId);
              if (idx < currentParent.children.length - 1) {
                e.preventDefault();
                e.stopPropagation();
                setFocusedNode(currentParent.children[idx + 1]);
                return;
              }
              currentId = currentParent.id;
              currentParent = graphState.nodes[currentParent.parent || ""];
            }
          }
        }
        return;
      }

      // --- 5. Alt + Up / Down (Move Block) ---
      if (e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (index > 0) {
          execute({
            type: "move_node",
            node_id: node.id,
            new_parent_id: node.parent,
            new_index: index - 1,
          });
          setFocusedNode(node.id);
        }
        return;
      }

      if (e.altKey && e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (index < parentNode.children.length - 1) {
          execute({
            type: "move_node",
            node_id: node.id,
            new_parent_id: node.parent,
            new_index: index + 1,
          });
          setFocusedNode(node.id);
        }
        return;
      }

      // --- 6. Cmd+D / Ctrl+D (Duplicate Block) ---
      if ((e.metaKey || e.ctrlKey) && e.key === "d") {
        e.preventDefault();
        e.stopPropagation();
        const newId = crypto.randomUUID();
        execute({
          type: "create_node",
          id: newId,
          kind: node.kind,
          parent_id: node.parent,
          index: index + 1,
          props: { ...node.props },
        });
        setFocusedNode(newId);
        return;
      }
    },
    [node, nextKind, nextProps, setFocusedNode],
  );
}

import React, { useCallback } from "react";
import { Node, val, RichText } from "../../../types/domain";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { useEditor } from "../../../context/EditorContext";
import { convertBlockType } from "../../../extensions/registry";
import { RichTextEditor } from "../../editors/RichTextEditor";
import { useBlockKeyDown } from "../../../hooks/useBlockKeyDown";

export const TaskWidget: React.FC<{ node: Node }> = ({ node }) => {
  const isFocused = useUIStore((state) => state.focusedNodeId === node.id);
  const { setFocusedNode } = useUIStore.getState();
  const { blockTypes } = useEditor();

  const checked = val<boolean>(node.props["checked"]) || false;
  const richText = val<RichText>(node.props["text"]) || { spans: [] };

  const handleChange = useCallback(
    (newText: any) => {
      execute({
        type: "set_prop",
        node_id: node.id,
        key: "text",
        value: { t: "Rich", v: newText },
      });
    },
    [node.id],
  );

  const baseKeyDown = useBlockKeyDown({
    node,
    nextKind: "core.task",
    nextProps: {
      text: { t: "Rich", v: { spans: [] } },
      checked: { t: "Bool", v: false },
    },
  });

  const paragraphSpec = blockTypes.find((s) => s.id === "paragraph");

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {

      if (
        e.key === "Backspace" &&
        (e.currentTarget.textContent || "").length === 0 &&
        paragraphSpec
      ) {
        e.preventDefault();
        convertBlockType(node, paragraphSpec);
        return;
      }
      baseKeyDown(e);
    },
    [node, paragraphSpec, baseKeyDown],
  );

  return (
    <div className="flex items-start gap-2 py-1 group">
      <div className="mt-[3px]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) =>
            execute({
              type: "set_prop",
              node_id: node.id,
              key: "checked",
              value: { t: "Bool", v: e.target.checked },
            })
          }
          className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 cursor-pointer accent-primary"
        />
      </div>
      <div
        className={`flex-1 cursor-text ${checked ? "opacity-50 line-through" : ""}`}
        onClick={() => setFocusedNode(node.id)}
      >
        <RichTextEditor
          value={richText}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="To-do"
          isFocused={isFocused}
        />
      </div>
    </div>
  );
};

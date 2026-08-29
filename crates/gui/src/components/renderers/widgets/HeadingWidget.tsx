import React, { useCallback } from "react";
import { Node, val, valRich } from "../../../types/domain";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { useEditor } from "../../../context/EditorContext";
import { convertBlockType } from "../../../extensions/registry";
import { RichTextEditor } from "../../editors/RichTextEditor";
import { useBlockKeyDown } from "../../../hooks/useBlockKeyDown";

export const HeadingWidget: React.FC<{ node: Node }> = ({ node }) => {
  const isFocused = useUIStore((state) => state.focusedNodeId === node.id);
  const { setFocusedNode } = useUIStore.getState();
  const { blockTypes } = useEditor();

  const level = val<number>(node.props["level"]) || 1;
  const richText = valRich(node.props["body"]);

  const sizeClass =
    {
      1: "text-2xl mt-4 mb-1 font-bold tracking-tight",
      2: "text-xl mt-3 mb-1 font-semibold tracking-tight",
      3: "text-lg mt-2.5 mb-1 font-semibold",
      4: "text-base mt-2 mb-1 font-medium",
      5: "text-sm mt-1.5 mb-1 font-medium",
      6: "text-xs mt-1 mb-1 font-medium",
    }[level] || "text-xl font-semibold";

  const handleChange = useCallback(
    (newText: any) => {
      execute({
        type: "set_prop",
        node_id: node.id,
        key: "body",
        value: { t: "Rich", v: newText },
      });
    },
    [node.id],
  );

  const paragraphSpec = blockTypes.find((s) => s.id === "paragraph");
  const baseKeyDown = useBlockKeyDown({ node });

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
    <div
      className={`text-foreground ${sizeClass}`}
      onClick={() => setFocusedNode(node.id)}
    >
      <RichTextEditor
        value={richText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`Heading ${level}`}
        isFocused={isFocused}
      />
    </div>
  );
};

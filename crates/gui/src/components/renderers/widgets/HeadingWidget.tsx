import React, { useCallback } from "react";
import { Node } from "../../../types/domain";
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

  const levelProp = node.props["level"];
  const level = levelProp?.t === "Int" ? levelProp.v : 1;

  const textProp = node.props["text"];
  const richText = textProp?.t === "Rich" ? textProp.v : { spans: [] };

  const sizeClass =
    {
      1: "text-3xl mt-6 mb-2 font-bold",
      2: "text-2xl mt-5 mb-2 font-semibold",
      3: "text-xl mt-4 mb-2 font-semibold",
      4: "text-lg mt-3 mb-1 font-medium",
      5: "text-base mt-2 mb-1 font-medium",
      6: "text-sm mt-2 mb-1 font-medium",
    }[level] || "text-xl font-semibold";

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

  // Backspace sur bloc vide → rétrograde en paragraphe via le registre
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
      className={`text-foreground/90 ${sizeClass}`}
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

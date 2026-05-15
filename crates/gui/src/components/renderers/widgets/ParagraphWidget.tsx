import React, { useCallback, useState } from "react";
import { Node, val, RichText } from "../../../types/domain";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { RichTextEditor } from "../../editors/RichTextEditor";
import { useEditor } from "../../../context/EditorContext";
import { convertBlockType } from "../../../extensions/registry";
import { useBlockKeyDown } from "../../../hooks/useBlockKeyDown";

export const ParagraphWidget: React.FC<{ node: Node }> = ({ node }) => {
  const isFocused = useUIStore((state) => state.focusedNodeId === node.id);
  const { setFocusedNode } = useUIStore.getState();
  const { blockTypes } = useEditor();

  const richText = val<RichText>(node.props["body"]) || { spans: [] };
  const text = richText.spans.map((s: any) => s.text).join("");

  const isSlashActive = isFocused && text.startsWith("/");
  const slashQuery = isSlashActive ? text.slice(1).toLowerCase() : "";
  const [slashIndex, setSlashIndex] = useState(0);

  const slashOptions = blockTypes.filter(
    (spec) =>
      spec.label.toLowerCase().includes(slashQuery) ||
      spec.id.includes(slashQuery) ||
      spec.keywords?.some((k) => k.includes(slashQuery)),
  );

  const handleChange = useCallback(
    (newText: any) => {
      const newPlainText = newText.spans.map((s: any) => s.text).join("");

      // Markdown shortcuts — délégués au registre
      const matchedSpec = blockTypes.find(
        (spec) => spec.markdownTrigger && newPlainText === spec.markdownTrigger,
      );
      if (matchedSpec) {
        convertBlockType(node, matchedSpec);
        return;
      }

      setSlashIndex(0);
      execute({
        type: "set_prop",
        node_id: node.id,
        key: "body",
        value: { t: "Rich", v: newText },
      });
    },
    [node, blockTypes],
  );

  const baseKeyDown = useBlockKeyDown({ node });

  const handleConvert = useCallback(
    (spec: any) => {
      // Nettoyer le "/" avant la conversion
      const cleanedProps = { ...node.props };
      const body = cleanedProps["body"];
      if (body?.t === "Rich" && body.v.spans[0]?.text.startsWith("/")) {
        cleanedProps["body"] = { t: "Rich", v: { spans: [] } };
      }
      convertBlockType({ ...node, props: cleanedProps }, spec);
    },
    [node],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // Slash menu intercepte en priorité
      if (isSlashActive && slashOptions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSlashIndex((i) => (i + 1) % slashOptions.length);
          return;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSlashIndex(
            (i) => (i - 1 + slashOptions.length) % slashOptions.length,
          );
          return;
        } else if (e.key === "Enter") {
          e.preventDefault();
          handleConvert(slashOptions[slashIndex]);
          return;
        } else if (e.key === "Escape") {
          e.preventDefault();
          execute({
            type: "set_prop",
            node_id: node.id,
            key: "body",
            value: { t: "Rich", v: { spans: [] } },
          });
          return;
        }
      }

      // Délègue le reste au hook commun
      baseKeyDown(e);
    },
    [
      node,
      isSlashActive,
      slashOptions,
      slashIndex,
      setSlashIndex,
      baseKeyDown,
      handleConvert,
    ],
  );

  return (
    <div className="py-1 relative" onClick={() => setFocusedNode(node.id)}>
      <RichTextEditor
        value={richText}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Type '/' for commands"
        isFocused={isFocused}
      />

      {/* Slash Command Menu */}
      {isSlashActive && slashOptions.length > 0 && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border shadow-lg rounded-lg overflow-hidden z-50">
          <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 border-b border-border/50">
            Blocks
          </div>
          <div className="py-1">
            {slashOptions.map((spec, idx) => (
              <button
                key={spec.id}
                onClick={() => handleConvert(spec)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 transition-colors ${
                  idx === slashIndex
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted/50 text-foreground/80"
                }`}
              >
                <div className="p-1 border border-border/50 rounded bg-background shadow-sm w-7 h-7 flex items-center justify-center">
                  {spec.icon}
                </div>
                <div>
                  <div className="font-medium">{spec.label}</div>
                  {spec.markdownTrigger && (
                    <div className="text-xs text-muted-foreground font-mono">
                      {spec.markdownTrigger.trim()}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

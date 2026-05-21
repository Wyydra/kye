import React, { useState, useCallback } from "react";
import { Node, valRich } from "../../../types/domain";
import { useUIStore } from "../../../store/uiStore";
import { execute } from "../../../lib/commands";
import { RichTextEditor } from "../../editors/RichTextEditor";
import { useBlockKeyDown } from "../../../hooks/useBlockKeyDown";
import { useEditor } from "../../../context/EditorContext";
import { convertBlockType } from "../../../extensions/registry";

export const FlashcardWidget: React.FC<{ node: Node }> = ({ node }) => {
  const isFocused = useUIStore((state) => state.focusedNodeId === node.id);
  const { setFocusedNode } = useUIStore.getState();
  const { blockTypes } = useEditor();

  const frontText = valRich(node.props["front"]);
  const backText = valRich(node.props["back"]);

  const [isFlipped, setIsFlipped] = useState(false);

  const handleFrontChange = useCallback(
    (newText: any) => {
      execute({
        type: "set_prop",
        node_id: node.id,
        key: "front",
        value: { t: "Rich", v: newText },
      });
    },
    [node.id],
  );

  const handleBackChange = useCallback(
    (newText: any) => {
      execute({
        type: "set_prop",
        node_id: node.id,
        key: "back",
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
      className={`my-3 flex flex-col w-full rounded-md border transition-all duration-200 ${
        isFocused
          ? "border-primary/60 shadow-[0_0_0_1px_rgba(var(--primary),0.1)] bg-card"
          : "border-border shadow-xs hover:border-border/80 bg-card"
      }`}
      onClick={() => setFocusedNode(node.id)}
    >
      {/* Minimalist Notion-style Header / Tab Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-1.5 select-none">
          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 114 0v2m-4 0h4m-4 0h8m-1 2v.01M17 16h.01" />
          </svg>
          <span className="text-[11px] font-medium tracking-tight text-muted-foreground">
            Flashcard
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsFlipped(false)}
            className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-all ${
              !isFlipped
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Front
          </button>
          <button
            onClick={() => setIsFlipped(true)}
            className={`px-2.5 py-0.5 text-[11px] font-medium rounded transition-all ${
              isFlipped
                ? "bg-secondary text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Back
          </button>
        </div>
      </div>

      {/* 3D Flip Card Container */}
      <div className="p-5 min-h-[110px] flex flex-col justify-center relative overflow-hidden bg-card">
        {/* Front Face */}
        <div
          className={`w-full transition-all duration-350 transform ${
            !isFlipped
              ? "opacity-100 scale-100 rotate-0 pointer-events-auto"
              : "opacity-0 scale-98 pointer-events-none absolute inset-x-5 top-5 bottom-5 flex flex-col justify-center"
          }`}
        >
          <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 select-none">
            Question
          </div>
          <div className="text-sm text-foreground">
            <RichTextEditor
              value={frontText}
              onChange={handleFrontChange}
              onKeyDown={handleKeyDown}
              placeholder="Question / Front side..."
              isFocused={isFocused && !isFlipped}
            />
          </div>
        </div>

        {/* Back Face */}
        <div
          className={`w-full transition-all duration-350 transform ${
            isFlipped
              ? "opacity-100 scale-100 rotate-0 pointer-events-auto"
              : "opacity-0 scale-98 pointer-events-none absolute inset-x-5 top-5 bottom-5 flex flex-col justify-center"
          }`}
        >
          <div className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1.5 select-none">
            Answer
          </div>
          <div className="text-sm text-foreground">
            <RichTextEditor
              value={backText}
              onChange={handleBackChange}
              onKeyDown={handleKeyDown}
              placeholder="Answer / Back side..."
              isFocused={isFocused && isFlipped}
            />
          </div>
        </div>
      </div>

      {/* Card Footer / Action Bar */}
      <div className="px-3 py-1.5 border-t border-border bg-secondary/10 flex items-center justify-between text-[10px] text-muted-foreground select-none">
        <span>Click tabs to toggle</span>
        <button
          onClick={() => setIsFlipped((prev) => !prev)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.228 9H18.9" />
          </svg>
          Flip Card
        </button>
      </div>
    </div>
  );
};

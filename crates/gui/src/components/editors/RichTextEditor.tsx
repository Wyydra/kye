import React, { useRef, useEffect, useCallback, useState } from "react";
import { RichText, Span, Mark } from "../../types/domain";
import { RichTextToolbar } from "./RichTextToolbar";

interface RichTextEditorProps {
  value: RichText | undefined;
  onChange: (value: RichText) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  isFocused?: boolean;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  onKeyDown,
  placeholder = "",
  isFocused,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isComposing, setIsComposing] = useState(false);

  // Convert RichText to HTML
  const spansToHtml = (spans: Span[]): string => {
    if (!spans || spans.length === 0) return "";
    return spans
      .map((span) => {
        let text = span.text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

        let html = text;
        const isBold = span.marks.some((m) => m.t === "Bold");
        const isItalic = span.marks.some((m) => m.t === "Italic");
        const isCode = span.marks.some((m) => m.t === "Code");
        const isStrikethrough = span.marks.some((m) => m.t === "Strikethrough");

        if (isBold) html = `<strong>${html}</strong>`;
        if (isItalic) html = `<em>${html}</em>`;
        if (isCode) html = `<code class="bg-muted px-1 rounded">${html}</code>`;
        if (isStrikethrough) html = `<s>${html}</s>`;

        return html;
      })
      .join("");
  };

  const htmlContent = spansToHtml(value?.spans || []);

  // Synchronize external value to DOM if needed
  useEffect(() => {
    if (editorRef.current && !isComposing) {
      if (editorRef.current.innerHTML !== htmlContent) {
        const newText = value?.spans.map((s) => s.text).join("") || "";
        
        // If the update is just the text we just typed, don't update DOM to avoid cursor jump
        if (isFocused && lastSentText.current === newText && editorRef.current.textContent === newText) {
          return;
        }

        editorRef.current.innerHTML = htmlContent;

        // Restore selection to the end
        if (isFocused) {
          try {
            const range = document.createRange();
            range.selectNodeContents(editorRef.current);
            range.collapse(false); // Move to end
            const sel = window.getSelection();
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch (e) {}
        }
      }
    }
  }, [htmlContent, isFocused, isComposing, value]);

  // Handle focus
  useEffect(() => {
    if (
      isFocused &&
      editorRef.current &&
      document.activeElement !== editorRef.current
    ) {
      editorRef.current.focus();
    }
  }, [isFocused]);

  const lastSentText = useRef<string | null>(null);

  const handleInput = useCallback(() => {
    if (!editorRef.current) return;

    const text = editorRef.current.textContent || "";
    lastSentText.current = text;

    // Preserve marks from the first span for now, so we don't lose formatting completely on typing
    const oldMarks = value?.spans[0]?.marks || [];
    onChange({ spans: [{ text, marks: oldMarks }] });
  }, [onChange, value]);

  const applyFormat = useCallback(
    (mark: Mark) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !editorRef.current) return;

      if (!editorRef.current.contains(selection.anchorNode)) return;

      const newSpans = (value?.spans || []).map((s) => {
        const hasMark = s.marks.some((m) => m.t === mark.t);
        const newMarks = hasMark
          ? s.marks.filter((m) => m.t !== mark.t)
          : [...s.marks, mark];
        return { ...s, marks: newMarks };
      });

      lastSentText.current = null; // Force DOM update for formatting
      onChange({ spans: newSpans });
    },
    [value, onChange],
  );

  return (
    <>
      <RichTextToolbar onFormat={applyFormat} targetRef={editorRef} />
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={onKeyDown}
        onCompositionStart={() => setIsComposing(true)}
        onCompositionEnd={() => {
          setIsComposing(false);
          handleInput();
        }}
        className="outline-none min-h-[1.5em] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/40 break-words cursor-text"
        data-placeholder={placeholder}
      />
    </>
  );
};

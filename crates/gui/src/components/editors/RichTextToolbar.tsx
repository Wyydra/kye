import React, { useEffect, useState, useRef } from "react";
import { useEditor } from "../../context/EditorContext";
import { Mark } from "../../types/domain";

interface ToolbarProps {
  onFormat: (mark: Mark) => void;
  targetRef: React.RefObject<HTMLDivElement>;
}

export const RichTextToolbar: React.FC<ToolbarProps> = ({ onFormat, targetRef }) => {
  const { marks } = useEditor();
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !targetRef.current) {
        setPosition(null);
        return;
      }

      // Check if selection is within our target editor
      if (!targetRef.current.contains(selection.anchorNode)) {
        setPosition(null);
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setPosition({
        top: rect.top - 44,
        left: rect.left + rect.width / 2,
      });
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("mouseup", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("mouseup", handleSelectionChange);
    };
  }, []);

  if (!position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 flex items-center gap-0.5 p-1 bg-popover border border-border shadow-lg rounded-lg -translate-x-1/2"
      style={{ top: Math.max(10, position.top), left: position.left }}
      onMouseDown={(e) => e.preventDefault()} // Prevent blur
    >
      {marks.map((spec) => (
        <button
          key={spec.id}
          onClick={() => onFormat(spec.mark)}
          title={spec.shortcut ? `${spec.label} ${spec.shortcut}` : spec.label}
          className="w-8 h-8 flex items-center justify-center hover:bg-muted text-foreground/80 hover:text-foreground rounded transition-colors"
        >
          {spec.icon}
        </button>
      ))}
    </div>
  );
};

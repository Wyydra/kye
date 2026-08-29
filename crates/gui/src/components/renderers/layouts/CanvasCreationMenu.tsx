import React, { useEffect, useRef } from "react";
import { useGraphStore } from "../../../store/graphStore";
import { KindList } from "../../kinds/KindList";

interface CanvasCreationMenuProps {
  x: number;
  y: number;
  onSelect: (kind: string) => void;
  onClose: () => void;
}

export const CanvasCreationMenu: React.FC<CanvasCreationMenuProps> = ({
  x,
  y,
  onSelect,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const kinds = useGraphStore((state) => state.kinds);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] w-64 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150"
      style={{ left: x, top: y }}
    >
      <div className="px-2 py-1 text-[10px] uppercase font-bold text-muted-foreground font-mono border-b border-border/40 mb-1">
        Add Block to Canvas
      </div>
      <KindList
        kinds={kinds}
        onSelect={(kId) => {
          onSelect(kId);
          onClose();
        }}
        showSearch
        searchPlaceholder="Search block types..."
        maxHeightClass="max-h-64"
        autoFocusSearch
      />
    </div>
  );
};

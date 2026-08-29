import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGraphStore } from "../../store/graphStore";
import { useBlockActions } from "../../hooks/useBlockActions";
import { extractTextFromValue } from "../../types/domain";
import {
  Edit2,
  Copy,
  Link,
  Trash2,
  ChevronRight,
  Check,
  Sparkles,
} from "lucide-react";
import { KindIcon } from "../kinds/KindIcon";
import { Badge } from "./Badge";
import { cn } from "../../lib/utils";

export interface BlockContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  nodeId: string;
  onClose: () => void;
  onStartRename?: () => void;
}

export const BlockContextMenu: React.FC<BlockContextMenuProps> = ({
  isOpen,
  x,
  y,
  nodeId,
  onClose,
  onStartRename,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const kinds = useGraphStore((state) => state.kinds);

  const {
    node,
    kindDef,
    typeActions,
    duplicateNode,
    copyWikiLink,
    convertKind,
    deleteNode,
    runAction,
  } = useBlockActions(nodeId);

  const [copied, setCopied] = useState(false);
  const [showKindSubmenu, setShowKindSubmenu] = useState(false);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !node) return null;

  // Viewport Boundary Clamping
  const menuWidth = 220;
  const menuHeight = 320;
  const clampedX = Math.min(Math.max(8, x), window.innerWidth - menuWidth - 8);
  const clampedY = Math.min(Math.max(8, y), window.innerHeight - menuHeight - 8);

  const title = extractTextFromValue(node.props.title) || "Untitled Block";

  const handleCopyLink = async () => {
    const ok = await copyWikiLink();
    if (ok) {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        onClose();
      }, 700);
    }
  };

  const menuContent = (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[300] w-56 bg-card/95 backdrop-blur-md border border-border/70 shadow-2xl rounded-xl p-1 font-sans text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header with Type & Title Preview */}
      <div className="px-2.5 py-1.5 border-b border-border/40 bg-muted/20 rounded-t-lg flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5 truncate min-w-0">
          <KindIcon kind={node.kind} kindDef={kindDef} size={13} className="text-primary" />
          <span className="truncate font-semibold text-xs text-foreground">{title}</span>
        </div>
        <Badge variant="muted" size="xs" className="shrink-0 font-mono text-[9px]">
          {kindDef?.label || node.kind.replace("core.", "")}
        </Badge>
      </div>

      <div className="py-1 space-y-0.5">
        {/* Action 1: Rename */}
        <button
          onClick={() => {
            onClose();
            if (onStartRename) onStartRename();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-foreground transition-colors cursor-pointer text-left"
        >
          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Rename</span>
        </button>

        {/* Action 2: Duplicate */}
        <button
          onClick={() => {
            duplicateNode();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-foreground transition-colors cursor-pointer text-left"
        >
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Duplicate</span>
        </button>

        {/* Action 3: Copy Link */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-foreground transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Copy Link</span>
          </div>
          {copied && (
            <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Copied
            </span>
          )}
        </button>

        {/* Action 4: Convert Type */}
        <div
          className="relative"
          onMouseEnter={() => setShowKindSubmenu(true)}
          onMouseLeave={() => setShowKindSubmenu(false)}
        >
          <button
            onClick={() => setShowKindSubmenu(!showKindSubmenu)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-foreground transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Change Type</span>
            </div>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>

          {showKindSubmenu && (
            <div className="absolute left-full top-0 ml-1 w-48 bg-card/95 backdrop-blur-md border border-border/70 shadow-2xl rounded-xl p-1 max-h-56 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[9px] uppercase font-bold text-muted-foreground border-b border-border/40 mb-1">
                Switch Type To
              </div>
              {Object.entries(kinds).map(([kId, kDef]) => (
                <button
                  key={kId}
                  onClick={() => {
                    convertKind(kId);
                    onClose();
                  }}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-colors cursor-pointer",
                    node.kind === kId
                      ? "bg-primary/10 text-primary font-semibold"
                      : "hover:bg-muted/60 text-foreground"
                  )}
                >
                  <KindIcon kind={kId} kindDef={kDef} size={13} />
                  <span className="truncate flex-1">{kDef.label}</span>
                  {node.kind === kId && <Check className="w-3 h-3 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Programmable Actions */}
        {typeActions.length > 0 && (
          <>
            <div className="my-1 border-t border-border/40" />
            <div className="px-2.5 py-0.5 text-[9px] uppercase font-bold text-muted-foreground/60">
              Actions
            </div>
            {typeActions.map((action) => (
              <button
                key={action.id}
                onClick={async () => {
                  await runAction(action);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-muted/60 text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="text-primary text-xs">•</span>
                <span className="truncate">{action.label}</span>
              </button>
            ))}
          </>
        )}

        {/* Destructive Action: Delete */}
        <div className="my-1 border-t border-border/40" />
        <button
          onClick={() => {
            deleteNode();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-destructive/15 text-destructive transition-colors cursor-pointer text-left font-medium"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Block</span>
        </button>
      </div>
    </div>
  );

  return createPortal(menuContent, document.body);
};

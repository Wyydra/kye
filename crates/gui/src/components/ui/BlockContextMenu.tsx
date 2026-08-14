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
import { VStack, HStack } from "./LayoutPrimitives";
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
  const iconEmoji = kindDef?.icon || "📄";

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
      className="fixed z-[300] w-56 bg-card/95 backdrop-blur-md border border-border/70 shadow-2xl rounded-xl p-1 font-mono text-xs select-none animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header with Type & Title Preview */}
      <HStack justify-between="true" className="px-2.5 py-1.5 border-b border-border/40 bg-muted/20 rounded-t-lg" align="center">
        <HStack gap="xs" align="center" className="truncate">
          <span className="text-xs shrink-0">{iconEmoji}</span>
          <span className="truncate font-semibold text-[11px] text-foreground">{title}</span>
        </HStack>
        <Badge variant="muted" className="text-[8.5px] uppercase shrink-0 font-mono ml-1">
          {kindDef?.label || node.kind.replace("core.", "")}
        </Badge>
      </HStack>

      <VStack gap="none" className="py-1">
        {/* Universal Action 1: Rename */}
        <button
          onClick={() => {
            onClose();
            if (onStartRename) onStartRename();
          }}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-foreground transition-colors cursor-pointer text-left"
        >
          <HStack gap="xs" align="center">
            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Rename</span>
          </HStack>
          <span className="text-[10px] text-muted-foreground/50">F2</span>
        </button>

        {/* Universal Action 2: Duplicate */}
        <button
          onClick={() => {
            duplicateNode();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-foreground transition-colors cursor-pointer text-left"
        >
          <Copy className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Duplicate</span>
        </button>

        {/* Universal Action 3: Copy WikiLink */}
        <button
          onClick={handleCopyLink}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-foreground transition-colors cursor-pointer text-left"
        >
          <HStack gap="xs" align="center">
            <Link className="w-3.5 h-3.5 text-muted-foreground" />
            <span>Copy WikiLink</span>
          </HStack>
          {copied ? (
            <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
              <Check className="w-3 h-3" /> Copied
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground/50">[[...]]</span>
          )}
        </button>

        {/* Universal Action 4: Convert Type (Submenu Trigger) */}
        <div
          className="relative"
          onMouseEnter={() => setShowKindSubmenu(true)}
          onMouseLeave={() => setShowKindSubmenu(false)}
        >
          <button
            onClick={() => setShowKindSubmenu(!showKindSubmenu)}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-foreground transition-colors cursor-pointer text-left"
          >
            <HStack gap="xs" align="center">
              <Sparkles className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Change Type</span>
            </HStack>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </button>

          {showKindSubmenu && (
            <div className="absolute left-full top-0 ml-1 w-48 bg-card/95 backdrop-blur-md border border-border/70 shadow-2xl rounded-xl p-1 max-h-56 overflow-y-auto space-y-0.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[9px] uppercase font-bold text-muted-foreground border-b border-border/40">
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
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors cursor-pointer",
                    node.kind === kId
                      ? "bg-primary/20 text-primary font-bold"
                      : "hover:bg-primary/20 hover:text-primary text-foreground"
                  )}
                >
                  <span>{kDef.icon || "📄"}</span>
                  <span className="truncate flex-1">{kDef.label}</span>
                  {node.kind === kId && <Check className="w-3 h-3 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Programmable Actions per Type */}
        {typeActions.length > 0 && (
          <>
            <div className="my-1 border-t border-border/40" />
            <div className="px-2.5 py-0.5 text-[9px] uppercase font-bold text-muted-foreground/60">
              Type Actions
            </div>
            {typeActions.map((action) => (
              <button
                key={action.id}
                onClick={async () => {
                  await runAction(action);
                  onClose();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-primary/20 hover:text-primary text-foreground transition-colors cursor-pointer text-left"
              >
                <span className="text-primary text-xs">◆</span>
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
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-destructive/20 text-destructive transition-colors cursor-pointer text-left font-semibold"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Block</span>
        </button>
      </VStack>
    </div>
  );

  return createPortal(menuContent, document.body);
};

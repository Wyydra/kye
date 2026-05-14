import React, { useEffect, useRef } from "react";
import { useUIStore } from "../../store/uiStore";
import { useGraphStore } from "../../store/graphStore";
import { DocumentLayout } from "../renderers/layouts/DocumentLayout";
import { X } from "lucide-react";

export const NodeModal: React.FC = () => {
  const modalNodeId = useUIStore((state) => state.modalNodeId);
  const setModalNodeId = useUIStore((state) => state.setModalNodeId);
  const node = useGraphStore((state) => modalNodeId ? state.nodes[modalNodeId] : undefined);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!modalNodeId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setModalNodeId(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalNodeId, setModalNodeId]);

  if (!modalNodeId || !node) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-background/50 backdrop-blur-sm animate-in fade-in duration-200"
      onPointerDown={(e) => {
        // If clicking the overlay directly, close it
        if (e.target === overlayRef.current) {
          setModalNodeId(null);
        }
      }}
      ref={overlayRef}
    >
      <div 
        className="relative w-full max-w-4xl h-[85vh] bg-background border border-border shadow-2xl rounded-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/30">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-2">
            Editing {node.kind.split('.').pop()}
          </div>
          <button 
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setModalNodeId(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <DocumentLayout node={node} depth={0} />
        </div>
      </div>
    </div>
  );
};

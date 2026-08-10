import React, { useEffect, useRef } from "react";
import { useUIStore } from "../../store/uiStore";
import { useGraphStore } from "../../store/graphStore";
import { DocumentSurface } from "../renderers/surfaces/DocumentSurface";
import { X } from "lucide-react";
import { ModalOverlay, ModalContent, ModalHeader } from "../ui/Modal";

export const NodeModal: React.FC = () => {
  const modalNodeId = useUIStore((state) => state.modalNodeId);
  const setModalNodeId = useUIStore((state) => state.setModalNodeId);
  const node = useGraphStore((state) => (modalNodeId ? state.nodes[modalNodeId] : undefined));
  const overlayRef = useRef<HTMLDivElement>(null);

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
    <ModalOverlay
      onPointerDown={(e) => {
        if (e.target === overlayRef.current) {
          setModalNodeId(null);
        }
      }}
      ref={overlayRef}
    >
      <ModalContent>
        <ModalHeader>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider ml-1">
            Editing {node.kind.split(".").pop()}
          </div>
          <button
            className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setModalNodeId(null)}
          >
            <X className="w-4 h-4" />
          </button>
        </ModalHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <DocumentSurface node={node} depth={0} layout={{ t: "VerticalStream" }} />
        </div>
      </ModalContent>
    </ModalOverlay>
  );
};

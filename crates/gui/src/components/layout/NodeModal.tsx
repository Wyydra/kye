import React from "react";
import { useUIStore } from "../../store/uiStore";
import { useGraphStore } from "../../store/graphStore";
import { DocumentSurface } from "../renderers/surfaces/DocumentSurface";
import { Modal } from "../ui/Modal";

export const NodeModal: React.FC = () => {
  const modalNodeId = useUIStore((state) => state.modalNodeId);
  const setModalNodeId = useUIStore((state) => state.setModalNodeId);
  const node = useGraphStore((state) => (modalNodeId ? state.nodes[modalNodeId] : undefined));

  const isOpen = Boolean(modalNodeId && node);
  const title = node ? `Editing ${node.kind.split(".").pop()}` : "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setModalNodeId(null)}
      size="xl"
      title={title}
    >
      {node && <DocumentSurface node={node} depth={0} layout={{ t: "VerticalStream" }} />}
    </Modal>
  );
};

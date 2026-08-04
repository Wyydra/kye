import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Node, val } from "../../../types/domain";
import { execute } from "../../../lib/commands";
import { kyeService } from "../../../services/kyeService";
import { useFileDrop } from "../../../hooks/useFileDrop";
import { useAssetUrl } from "../../../hooks/useAssetUrl";

export const ImageWidget: React.FC<{ node: Node }> = ({ node }) => {
  const sidecarNodeId = val<string>(node.props.url);
  const title = val<string>(node.props.title);
  const assetUrl = useAssetUrl(sidecarNodeId);

  const dropRef = useFileDrop<HTMLDivElement>(async (paths) => {
    if (paths && paths.length > 0) {
      try {
        const assetInfo = await kyeService.importAsset(paths[0]);
        if (!assetInfo.node_id) return;
        execute({
          type: "set_prop",
          node_id: node.id,
          key: "url",
          value: { t: "Ref", v: assetInfo.node_id },
        });
      } catch (e) {
        console.error("Failed to import asset on drop", e);
      }
    }
  });

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpeg", "jpg", "gif", "webp"] }],
      });
      if (typeof selected === "string") {
        const assetInfo = await kyeService.importAsset(selected);
        if (!assetInfo.node_id) return;
        execute({
          type: "set_prop",
          node_id: node.id,
          key: "url",
          value: { t: "Ref", v: assetInfo.node_id },
        });
      }
    } catch (e) {
      console.error("Failed to select image", e);
    }
  };

  if (!sidecarNodeId) {
    return (
      <div
        ref={dropRef}
        className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors my-2"
        onClick={handleSelectImage}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2 opacity-50">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
        <span className="text-sm font-medium">Click to select an image</span>
        <span className="text-xs opacity-70">or drag and drop one here</span>
      </div>
    );
  }

  if (!assetUrl) {
    return <div className="text-muted-foreground italic text-sm py-4">Loading image...</div>;
  }

  return (
    <div ref={dropRef} className="flex flex-col items-center my-2 max-w-full">
      <img
        src={assetUrl}
        alt={title || "Kye Image"}
        className="max-w-full h-auto rounded-md shadow-sm pointer-events-none"
        style={{ maxHeight: "600px" }}
      />
      {title && <span className="text-sm text-gray-500 mt-2 italic">{title}</span>}
    </div>
  );
};

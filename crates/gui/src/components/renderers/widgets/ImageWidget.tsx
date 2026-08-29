import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Node, val } from "../../../types/domain";
import { execute } from "../../../lib/commands";
import { kyeService } from "../../../services/kyeService";
import { useFileDrop } from "../../../hooks/useFileDrop";
import { useAssetUrl } from "../../../hooks/useAssetUrl";
import { useUIStore } from "../../../store/uiStore";
import { ImageIcon } from "lucide-react";

export const ImageWidget: React.FC<{ node: Node }> = ({ node }) => {
  const urlProp = val<string>(node.props.url) || val<string>(node.props.target);
  const explicitCaption = val<string>(node.props.caption) || val<string>(node.props.title);
  const isUuidOrPlaceholder =
    !explicitCaption ||
    explicitCaption.match(/^[0-9a-fA-F-]{16,}$/) ||
    explicitCaption === "image" ||
    explicitCaption === "document";

  const assetUrl = useAssetUrl(urlProp);
  const setFocusedNode = useUIStore((state) => state.setFocusedNode);

  const dropRef = useFileDrop<HTMLDivElement>(async (paths) => {
    if (paths && paths.length > 0) {
      try {
        const importedUrl = await kyeService.importAsset(paths[0]);
        if (!importedUrl) return;
        execute({
          type: "set_prop",
          node_id: node.id,
          key: "url",
          value: { t: "Text", v: importedUrl },
        });
        setFocusedNode(node.id);
      } catch (e) {
        console.error("Failed to import asset on drop", e);
      }
    }
  });

  const handleSelectImage = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Images", extensions: ["png", "jpeg", "jpg", "gif", "webp", "svg"] }],
      });
      if (typeof selected === "string") {
        const importedUrl = await kyeService.importAsset(selected);
        if (!importedUrl) return;
        execute({
          type: "set_prop",
          node_id: node.id,
          key: "url",
          value: { t: "Text", v: importedUrl },
        });
        setFocusedNode(node.id);
      }
    } catch (e) {
      console.error("Failed to select image", e);
    }
  };

  if (!urlProp) {
    return (
      <div
        ref={dropRef}
        onClick={(e) => {
          e.stopPropagation();
          setFocusedNode(node.id);
          handleSelectImage();
        }}
        className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-border/70 rounded-xl bg-muted/15 text-muted-foreground hover:bg-muted/30 hover:border-primary/50 cursor-pointer transition-all duration-150 my-2 font-sans select-none gap-1.5"
      >
        <ImageIcon className="w-6 h-6 text-primary/70" />
        <span className="text-xs font-semibold text-foreground">
          Click to choose an image
        </span>
        <span className="text-[11px] text-muted-foreground/60">
          or drag and drop here
        </span>
      </div>
    );
  }

  return (
    <div
      ref={dropRef}
      onClick={(e) => {
        e.stopPropagation();
        setFocusedNode(node.id);
      }}
      className="flex flex-col items-center my-2 max-w-full font-sans cursor-pointer select-none"
    >
      {assetUrl ? (
        <img
          src={assetUrl}
          alt={isUuidOrPlaceholder ? "Image" : explicitCaption}
          className="max-w-full h-auto object-contain block rounded-xl border border-border/70 shadow-xs pointer-events-none"
          style={{ maxHeight: "600px" }}
        />
      ) : (
        <div className="w-full h-40 flex items-center justify-center bg-muted/20 border border-border/60 rounded-xl">
          <ImageIcon className="w-8 h-8 text-muted-foreground/40 animate-pulse" />
        </div>
      )}
      {!isUuidOrPlaceholder && (
        <span className="text-xs text-muted-foreground italic mt-1.5">{explicitCaption}</span>
      )}
    </div>
  );
};

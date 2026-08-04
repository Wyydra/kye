import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Node, val } from "../../../types/domain";
import { execute } from "../../../lib/commands";
import { kyeService } from "../../../services/kyeService";
import { useFileDrop } from "../../../hooks/useFileDrop";
import { useAssetUrl } from "../../../hooks/useAssetUrl";
import { useGraphStore } from "../../../store/graphStore";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeInfo(path?: string, mime?: string) {
  const ext = (path?.split(".").pop() || "").toLowerCase();

  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext) || mime?.startsWith("image/")) {
    return { type: "image", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", label: "IMAGE", isImage: true };
  }
  if (ext === "pdf" || mime === "application/pdf") {
    return { type: "pdf", color: "bg-red-500/10 text-red-500 border-red-500/20", label: "PDF", isImage: false };
  }
  if (["doc", "docx"].includes(ext)) {
    return { type: "word", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20", label: "DOCX", isImage: false };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return { type: "excel", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", label: "SHEET", isImage: false };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return { type: "ppt", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", label: "SLIDES", isImage: false };
  }
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
    return { type: "archive", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", label: "ARCHIVE", isImage: false };
  }
  return { type: "file", color: "bg-slate-500/10 text-slate-500 border-slate-500/20", label: ext.toUpperCase() || "FILE", isImage: false };
}

export const FileWidget: React.FC<{ node: Node }> = ({ node }) => {
  const sidecarNodeId = val<string>(node.props.url);
  const sidecarNode = useGraphStore((state) => (sidecarNodeId ? state.nodes[sidecarNodeId] : null));

  const targetFile = sidecarNode ? val<string>(sidecarNode.props.target) : null;
  const title = (sidecarNode ? val<string>(sidecarNode.props.title) : null) || val<string>(node.props.title) || targetFile || "Untitled File";
  const mimeType = sidecarNode ? val<string>(sidecarNode.props.mime_type) : val<string>(node.props.mime_type);
  const sizeBytes = sidecarNode ? val<number>(sidecarNode.props.size_bytes) : val<number>(node.props.size_bytes);

  const assetUrl = useAssetUrl(sidecarNodeId);
  const fileInfo = getFileTypeInfo(targetFile || "", mimeType);

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

  const handleSelectFile = async () => {
    try {
      const selected = await open({ multiple: false });
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
      console.error("Failed to select file", e);
    }
  };

  const handleOpenExternal = async () => {
    if (!targetFile) return;
    try {
      await kyeService.openAsset(targetFile);
    } catch (e) {
      console.error("Failed to open file externally", e);
    }
  };

  const handleRevealInExplorer = async () => {
    if (!targetFile) return;
    try {
      await kyeService.revealAsset(targetFile);
    } catch (e) {
      console.error("Failed to reveal file in folder", e);
    }
  };

  if (!sidecarNodeId) {
    return (
      <div
        ref={dropRef}
        className="w-full h-32 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground hover:bg-muted/50 cursor-pointer transition-colors my-2"
        onClick={handleSelectFile}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-2 opacity-50">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
        <span className="text-sm font-medium">Click to select a file (PDF, DOCX, XLSX, Image...)</span>
        <span className="text-xs opacity-70">or drag and drop one here</span>
      </div>
    );
  }

  // Render image preview if it's an image
  if (fileInfo.isImage && assetUrl) {
    return (
      <div ref={dropRef} className="flex flex-col items-center my-2 max-w-full group relative">
        <img
          src={assetUrl}
          alt={title}
          className="max-w-full h-auto rounded-md shadow-sm border border-border"
          style={{ maxHeight: "600px" }}
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleOpenExternal}
            className="text-xs px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
            title="Open in OS application"
          >
            ↗ Open
          </button>
          <button
            onClick={handleRevealInExplorer}
            className="text-xs px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-1"
            title="Show in folder"
          >
            📁 Folder
          </button>
          {title && <span className="text-sm text-muted-foreground italic ml-2">{title}</span>}
        </div>
      </div>
    );
  }

  // Render rich generic file widget (PDF, DOCX, XLSX, etc.)
  return (
    <div
      ref={dropRef}
      className="flex items-center justify-between p-3.5 my-2 rounded-lg border border-border bg-card/60 hover:bg-card/90 shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`px-2.5 py-1.5 rounded-md text-xs font-bold border ${fileInfo.color} shrink-0`}>
          {fileInfo.label}
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-semibold text-foreground truncate">{title}</span>
          <span className="text-xs text-muted-foreground truncate font-mono">{targetFile} {sizeBytes ? `• ${formatBytes(sizeBytes)}` : ""}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <button
          onClick={handleOpenExternal}
          className="px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Open
        </button>

        <button
          onClick={handleRevealInExplorer}
          className="px-2.5 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1"
          title="Show in File Explorer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

import React from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Node, val } from "../../../types/domain";
import { execute } from "../../../lib/commands";
import { kyeService } from "../../../services/kyeService";
import { useFileDrop } from "../../../hooks/useFileDrop";
import { useGraphStore } from "../../../store/graphStore";
import { useUIStore } from "../../../store/uiStore";
import { UploadCloud, FileText } from "lucide-react";

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileTypeInfo(path?: string, mime?: string) {
  const ext = (path?.split(".").pop() || "").toLowerCase();

  if (ext === "pdf" || mime === "application/pdf") {
    return {
      type: "pdf",
      color: "bg-red-500/10 text-red-500 border-red-500/20",
      label: "PDF",
    };
  }
  if (["doc", "docx"].includes(ext)) {
    return {
      type: "word",
      color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      label: "DOCX",
    };
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return {
      type: "excel",
      color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      label: "SHEET",
    };
  }
  if (["ppt", "pptx"].includes(ext)) {
    return {
      type: "ppt",
      color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
      label: "SLIDES",
    };
  }
  if (["zip", "tar", "gz", "7z", "rar"].includes(ext)) {
    return {
      type: "archive",
      color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      label: "ARCHIVE",
    };
  }
  return {
    type: "file",
    color: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    label: ext.toUpperCase() || "FILE",
  };
}

export const FileWidget: React.FC<{ node: Node }> = ({ node }) => {
  const rawUrl = val<string>(node.props.url) || val<string>(node.props.target) || val<string>(node.props.path);

  const setFocusedNode = useUIStore((state) => state.setFocusedNode);
  const assetNode = useGraphStore((state) => (rawUrl ? state.nodes[rawUrl] : null));
  const targetFile =
    (assetNode ? val<string>(assetNode.props.target) || val<string>(assetNode.props.url) || val<string>(assetNode.props.path) : null) ||
    rawUrl;

  const fileName =
    (assetNode ? val<string>(assetNode.props.title) : null) ||
    val<string>(node.props.title) ||
    (targetFile ? targetFile.split(/[\/\\]/).pop() : null) ||
    "Document";

  const mimeType = assetNode ? val<string>(assetNode.props.mime_type) : undefined;
  const sizeBytes = assetNode ? val<number>(assetNode.props.size_bytes) : undefined;
  const fileInfo = getFileTypeInfo(targetFile || "", mimeType);

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

  const handleSelectFile = async () => {
    try {
      const selected = await open({ multiple: false });
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
      console.error("Failed to select file", e);
    }
  };

  if (!rawUrl) {
    return (
      <div
        ref={dropRef}
        onClick={(e) => {
          e.stopPropagation();
          setFocusedNode(node.id);
          handleSelectFile();
        }}
        className="w-full h-28 flex flex-col items-center justify-center border-2 border-dashed border-border/70 rounded-xl bg-muted/15 text-muted-foreground hover:bg-muted/30 hover:border-primary/50 cursor-pointer transition-all duration-150 my-2 font-sans select-none gap-1.5"
      >
        <UploadCloud className="w-6 h-6 text-primary/70" />
        <span className="text-xs font-semibold text-foreground">
          Click to attach a file
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
      className="flex items-center gap-3 p-3 my-2 rounded-xl border border-border/70 bg-card/70 hover:border-primary/40 shadow-xs font-sans select-none cursor-pointer transition-colors"
    >
      <div className={`px-2 py-1 rounded-lg text-xs font-bold border ${fileInfo.color} shrink-0`}>
        {fileInfo.label}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-xs font-semibold text-foreground truncate">{fileName}</span>
        <span className="text-[10px] text-muted-foreground font-mono truncate">
          {sizeBytes ? formatBytes(sizeBytes) : "Embedded Attachment"}
        </span>
      </div>
      <FileText className="w-4 h-4 text-muted-foreground/40 shrink-0" />
    </div>
  );
};

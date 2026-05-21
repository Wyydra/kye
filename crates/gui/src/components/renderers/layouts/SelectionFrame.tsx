import React from "react";
import { HandleType } from "../../../hooks/useResizable";
import { ResizeHandles } from "./ResizeHandles";
import { ConnectionHandles } from "./ConnectionHandles";
import { BlockToolbar } from "./BlockToolbar";
import { execute } from "../../../lib/commands";
import { useUIStore } from "../../../store/uiStore";
import { confirm } from "@tauri-apps/plugin-dialog";

interface SelectionFrameProps {
  nodeId: string;
  isLocked?: boolean;
  onResizeStart: (e: React.PointerEvent, type: HandleType) => void;
  onConnectStart: (e: React.PointerEvent, side: string) => void;
  onToggleLock: () => void;
}

export const SelectionFrame: React.FC<SelectionFrameProps> = ({
  nodeId,
  isLocked,
  onResizeStart,
  onConnectStart,
  onToggleLock,
}) => {
  return (
    <div 
      className="absolute pointer-events-none z-[100]"
      style={{
        top: -4,
        left: -4,
        right: -4,
        bottom: -4,
      }}
    >
      {}
      <div className={`absolute inset-0 border-2 rounded-xl ring-4 animate-in fade-in zoom-in-95 duration-200 ${
        isLocked ? "border-orange-500/30 ring-orange-500/5" : "border-primary/30 ring-primary/5"
      }`} />

      {}
      <BlockToolbar 
        isLocked={isLocked}
        onToggleLock={onToggleLock}
        onEdit={() => useUIStore.getState().setModalNodeId(nodeId)}
        onDelete={async () => {
          const yes = await confirm("Delete this node?", { title: "Kye", kind: "warning" });
          if (yes) {
            execute({ type: "delete_node", id: nodeId, cascade: true });
          }
        }} 
        onDuplicate={() => {

        }}
      />

      {}
      {!isLocked && <ResizeHandles onResizeStart={onResizeStart} />}

      {}
      <ConnectionHandles onConnectStart={onConnectStart} />
    </div>
  );
};

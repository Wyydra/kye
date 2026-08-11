import React from "react";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Plus, FolderOpen, Terminal } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Card } from "../ui/Card";
import { VStack, HStack } from "../ui/LayoutPrimitives";

export const WorkspacePicker: React.FC = () => {
  const isOpen = useUIStore((state) => state.isWorkspacePickerOpen);
  const setOpen = useUIStore((state) => state.setWorkspacePickerOpen);

  const handleOpenExistingFile = async () => {
    try {
      const res = await kyeService.selectWorkspaceFolder();
      if (res) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to open workspace file", e);
    }
  };

  const handleCreateNewFile = async () => {
    try {
      const res = await kyeService.createWorkspaceFile();
      if (res) {
        window.location.reload();
      }
    } catch (e) {
      console.error("Failed to create workspace file", e);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => setOpen(false)}
      size="md"
      title={
        <HStack gap="xs">
          <Terminal className="w-4 h-4 text-primary" />
          <span>KYE_WORKSPACES</span>
        </HStack>
      }
    >
      <VStack gap="md" className="font-mono">
        <Card interactive onClick={handleCreateNewFile}>
          <HStack gap="md">
            <div className="p-3 bg-primary/10 text-primary rounded-lg">
              <Plus className="w-5 h-5" />
            </div>
            <VStack gap="none" className="flex-1">
              <span className="text-xs font-bold text-foreground">Create New Directory</span>
              <span className="text-[11px] text-muted-foreground">Pick name and location</span>
            </VStack>
          </HStack>
        </Card>

        <Card interactive onClick={handleOpenExistingFile}>
          <HStack gap="md">
            <div className="p-3 bg-muted text-muted-foreground rounded-lg">
              <FolderOpen className="w-5 h-5" />
            </div>
            <VStack gap="none" className="flex-1">
              <span className="text-xs font-bold text-foreground">Open Directory</span>
              <span className="text-[11px] text-muted-foreground">Browse for existing workspace</span>
            </VStack>
          </HStack>
        </Card>
      </VStack>
    </Modal>
  );
};

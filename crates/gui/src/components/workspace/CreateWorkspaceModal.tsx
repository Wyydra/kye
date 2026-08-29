import React, { useState, useEffect } from "react";
import { useGraphStore } from "../../store/graphStore";
import { useUIStore } from "../../store/uiStore";
import { kyeService } from "../../services/kyeService";
import { Modal } from "../ui/Modal";
import { FormField } from "../ui/FormField";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Folder, FolderOpen } from "lucide-react";

export const CreateWorkspaceModal: React.FC = () => {
  const isOpen = useUIStore((state) => state.isCreateWorkspaceModalOpen);
  const setOpen = useUIStore((state) => state.setCreateWorkspaceModalOpen);
  const createWorkspace = useGraphStore((state) => state.createWorkspace);

  const [name, setName] = useState("");
  const [directory, setDirectory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setError(null);
      setIsSubmitting(false);
      kyeService
        .getDefaultWorkspaceDir()
        .then((dir) => setDirectory(dir))
        .catch(console.error);
    }
  }, [isOpen]);

  const handlePickDirectory = async () => {
    try {
      const picked = await kyeService.pickWorkspaceDirectory();
      if (picked) {
        setDirectory(picked);
      }
    } catch (e) {
      console.error("Failed to pick directory", e);
    }
  };

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a workspace name.");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await createWorkspace(trimmed, directory || undefined);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to create workspace.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !isSubmitting && setOpen(false)}
      size="sm"
      title={<span className="font-semibold text-sm">New Workspace</span>}
    >
      <form onSubmit={handleCreate} className="space-y-4 text-xs font-sans">
        <FormField label="Workspace Name" error={error} required>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Personal Notes, Project Alpha..."
            autoFocus
            disabled={isSubmitting}
            error={Boolean(error)}
          />
        </FormField>

        <FormField label="Storage Location">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-muted/20 border border-border/60 rounded-lg text-muted-foreground font-mono text-[11px] truncate">
              <Folder className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{directory || "Default Folder"}</span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              leftIcon={<FolderOpen className="w-3.5 h-3.5" />}
              onClick={handlePickDirectory}
              disabled={isSubmitting}
            >
              Browse
            </Button>
          </div>
        </FormField>

        <div className="flex items-center justify-between pt-3 border-t border-border/40">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </div>
      </form>
    </Modal>
  );
};

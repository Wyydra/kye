import { useState, useEffect, useCallback, useRef } from 'react';
import { workspaceService } from '../services/WorkspaceService';
import type { Workspace, TemplateDto } from '../types/workspace';

type MutationError = { kind: 'create' | 'update' | 'delete'; message: string };

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [mutationError, setMutationError] = useState<MutationError | null>(null);

  const updateTimeouts = useRef<Record<string, number>>({});
  const loadWorkspaceDebounced = useRef<number | null>(null);
  const isFirstLoad = useRef(true);

  const loadWorkspace = useCallback(async () => {
    if (loadWorkspaceDebounced.current) {
      window.clearTimeout(loadWorkspaceDebounced.current);
    }

    loadWorkspaceDebounced.current = window.setTimeout(async () => {
      try {
        const [ws, path] = await Promise.all([
          workspaceService.getWorkspace(),
          workspaceService.getWorkspacePath(),
        ]);
        setWorkspace(ws);
        setWorkspacePath(path);
        setIsLoading(false);
        loadWorkspaceDebounced.current = null;

        // If it's the first load and we're in test_workspace (default),
        // we might want to prompt the user to select a real one.
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
        }
      } catch (e) {
        console.error('Failed to load workspace:', e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsLoading(false);
      }
    }, 100);
  }, []);

  useEffect(() => {
    loadWorkspace();
    workspaceService.getTemplates()
      .then(setTemplates)
      .catch(e => console.error('Failed to load templates:', e));

    let unlisten: (() => void) | null = null;
    workspaceService.onWorkspaceUpdated(() => {
      loadWorkspace();
    }).then(fn => { unlisten = fn; });

    return () => {
      if (unlisten) unlisten();
      if (loadWorkspaceDebounced.current) {
        window.clearTimeout(loadWorkspaceDebounced.current);
      }
    };
  }, [loadWorkspace]);

  const updateBlock = useCallback(async (
    id: string,
    content: string | null,
    metadata: Record<string, any> | null
  ) => {
    const key = `${id}_${content !== null ? 'content' : 'meta'}`;

    // Optimistic update
    setWorkspace(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map(block => {
          if (block.id === id) {
            return {
              ...block,
              content: content !== null ? content : block.content,
              metadata: metadata !== null ? JSON.stringify(metadata) : block.metadata,
            };
          }
          return block;
        }),
      };
    });

    if (updateTimeouts.current[key]) {
      clearTimeout(updateTimeouts.current[key]);
    }

    updateTimeouts.current[key] = window.setTimeout(async () => {
      try {
        const ws = await workspaceService.updateBlock(
          id,
          content,
          metadata ? JSON.stringify(metadata) : null
        );
        setWorkspace(ws);
      } catch (e) {
        const message = String(e);
        console.error(`Failed to update block ${id}:`, message);
        setMutationError({ kind: 'update', message });
        // rollback
        loadWorkspace();
      }
    }, 1000);
  }, [loadWorkspace]);

  const createBlock = useCallback(async (content: string, metadata: Record<string, any>) => {
    try {
      const [updatedWorkspace, newBlockId] = await workspaceService.createBlock(
        content,
        JSON.stringify(metadata)
      );
      setWorkspace(updatedWorkspace);
      return newBlockId;
    } catch (e) {
      const message = String(e);
      console.error('Failed to create block:', message);
      setMutationError({ kind: 'create', message });
      throw new Error(message);
    }
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    try {
      const ws = await workspaceService.deleteBlock(id);
      setWorkspace(ws);
    } catch (e) {
      const message = String(e);
      console.error(`Failed to delete block ${id}:`, message);
      setMutationError({ kind: 'delete', message });
      throw new Error(message);
    }
  }, []);

  const consumeMutationError = useCallback(() => {
    const err = mutationError;
    setMutationError(null);
    return err;
  }, [mutationError]);

  const selectWorkspace = useCallback(async () => {
    try {
      const newPath = await workspaceService.selectWorkspaceFolder();
      setWorkspacePath(newPath);
      loadWorkspace();
    } catch (e) {
      console.error('Failed to select workspace:', e);
    }
  }, [loadWorkspace]);

  return {
    workspace,
    workspacePath,
    setWorkspacePath,
    templates,
    isLoading,
    error,
    mutationError,
    consumeMutationError,
    updateBlock,
    createBlock,
    deleteBlock,
    selectWorkspace,
    refreshWorkspace: loadWorkspace,
  };
}

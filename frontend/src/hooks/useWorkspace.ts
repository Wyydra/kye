import { useState, useEffect, useCallback, useRef } from 'react';
import { workspaceService } from '../services/WorkspaceService';
import type { Workspace } from '../types/workspace';

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const updateTimeouts = useRef<Record<string, number>>({});
  const loadWorkspaceDebounced = useRef<number | null>(null);

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
      } catch (e) {
        console.error("Failed to load workspace:", e);
        setError(e instanceof Error ? e : new Error(String(e)));
        setIsLoading(false);
      }
    }, 100);
  }, []);

  useEffect(() => {
    loadWorkspace();
    
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

  const updateBlock = useCallback(async (id: string, content: string | null, metadata: Record<string, any> | null) => {
    const key = `${id}_${content !== null ? 'content' : 'meta'}`;
    
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
        console.error(`Failed to update block ${id}:`, e);
      }
    }, 1000);
  }, []);

  const createBlock = useCallback(async (content: string, metadata: Record<string, any>) => {
    try {
      const [updatedWorkspace, newBlockId] = await workspaceService.createBlock(
        content, 
        JSON.stringify(metadata)
      );
      setWorkspace(updatedWorkspace);
      return newBlockId;
    } catch (e) {
      console.error("Failed to create block:", e);
      throw e;
    }
  }, []);

  const deleteBlock = useCallback(async (id: string) => {
    try {
      const ws = await workspaceService.deleteBlock(id);
      setWorkspace(ws);
    } catch (e) {
      console.error(`Failed to delete block ${id}:`, e);
      throw e;
    }
  }, []);

  return {
    workspace,
    workspacePath,
    isLoading,
    error,
    updateBlock,
    createBlock,
    deleteBlock,
    refreshWorkspace: loadWorkspace
  };
}

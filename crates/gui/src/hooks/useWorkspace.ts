import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Workspace } from '../types/workspace';

export type WorkspaceError = 'NO_WORKSPACE' | 'FETCH_ERROR' | null;

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<WorkspaceError>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      // Avoid setting isLoading=true on background refetches to prevent UI flickering
      const data = await invoke<Workspace>('get_workspace');
      setWorkspace(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch workspace:', err);
      // Tauri errors are objects; detect the "no workspace" case robustly
      const message = typeof err === 'string' ? err : JSON.stringify(err);
      setError(message.includes('No workspace selected') ? 'NO_WORKSPACE' : 'FETCH_ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchWorkspace();

    // Listen to backend file system events
    let unlisten: UnlistenFn | undefined;
    
    const setupListener = async () => {
      unlisten = await listen('workspace_updated', () => {
        console.log("Workspace updated event received, refetching...");
        fetchWorkspace();
      });
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [fetchWorkspace]);

  const noWorkspace = error === 'NO_WORKSPACE';
  return { workspace, isLoading, error, noWorkspace, refresh: fetchWorkspace };
}

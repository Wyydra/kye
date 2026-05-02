import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { Workspace, TemplateDto } from '../types/workspace';

export type WorkspaceError = 'NO_WORKSPACE' | 'FETCH_ERROR' | null;

export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspacePath, setWorkspacePath] = useState<string>('');
  const [templates, setTemplates] = useState<TemplateDto[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<WorkspaceError>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      const [data, path, tmpl] = await Promise.all([
        invoke<Workspace>('get_workspace'),
        invoke<string>('get_workspace_path'),
        invoke<TemplateDto[]>('get_templates'),
      ]);
      setWorkspace(data);
      setWorkspacePath(path);
      setTemplates(tmpl);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch workspace:', err);
      const message = typeof err === 'string' ? err : JSON.stringify(err);
      setError(message.includes('No workspace selected') ? 'NO_WORKSPACE' : 'FETCH_ERROR');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectWorkspace = useCallback(async () => {
    try {
      await invoke('select_workspace_folder');
      await fetchWorkspace();
    } catch (e) {
      console.error('Failed to select workspace:', e);
    }
  }, [fetchWorkspace]);

  useEffect(() => {
    fetchWorkspace();

    let unlisten: UnlistenFn | undefined;
    listen('workspace_updated', fetchWorkspace).then(fn => { unlisten = fn; });

    return () => { unlisten?.(); };
  }, [fetchWorkspace]);

  return {
    workspace,
    workspacePath,
    templates,
    isLoading,
    error,
    noWorkspace: error === 'NO_WORKSPACE',
    refresh: fetchWorkspace,
    selectWorkspace,
  };
}


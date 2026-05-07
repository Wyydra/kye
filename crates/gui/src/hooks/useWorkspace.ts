import { useState, useEffect, useCallback } from 'react';
import { workspaceService } from '../services/WorkspaceService';
import { Workspace, TemplateDto } from '../types/workspace';
import { UnlistenFn } from '@tauri-apps/api/event';

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
        workspaceService.getWorkspace(),
        workspaceService.getWorkspacePath(),
        workspaceService.getTemplates(),
      ]);
      setWorkspace(prev => {
        const nextStr = JSON.stringify(data);
        return JSON.stringify(prev) === nextStr ? prev : data;
      });
      setWorkspacePath(path);
      setTemplates(prev => {
        const nextStr = JSON.stringify(tmpl);
        return JSON.stringify(prev) === nextStr ? prev : tmpl;
      });
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
      await workspaceService.selectWorkspaceFolder();
      await fetchWorkspace();
    } catch (e) {
      console.error('Failed to select workspace:', e);
    }
  }, [fetchWorkspace]);

  useEffect(() => {
    fetchWorkspace();

    let unlisten: UnlistenFn | undefined;
    workspaceService.onWorkspaceUpdated(fetchWorkspace).then(fn => { unlisten = fn; });

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


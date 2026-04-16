import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useWorkspace as useWorkspaceHook } from '../hooks/useWorkspace';
import { useToast } from './ToastContext';
import type { Workspace, TemplateDto } from '../types/workspace';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspacePath: string;
  templates: TemplateDto[];
  isLoading: boolean;
  error: Error | null;
  updateBlock: (id: string, content: string | null, metadata: Record<string, any> | null) => Promise<void>;
  createBlock: (content: string, metadata: Record<string, any>) => Promise<string>;
  deleteBlock: (id: string) => Promise<void>;
  setWorkspacePath: (path: string) => void;
  selectWorkspace: () => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspaceValue = useWorkspaceHook();
  const { toast } = useToast();

  useEffect(() => {
    if (workspaceValue.mutationError) {
      const err = workspaceValue.consumeMutationError();
      if (err) {
        const prefix = err.kind === 'create'
          ? 'Unable to create'
          : err.kind === 'delete'
          ? 'Unable to delete'
          : 'Unable to update';
        toast(`${prefix} : ${err.message}`, 'error');
      }
    }
  }, [workspaceValue.mutationError, workspaceValue.consumeMutationError, toast]);

  return (
    <WorkspaceContext.Provider value={workspaceValue}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

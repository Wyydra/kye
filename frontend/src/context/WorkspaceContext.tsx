import React, { createContext, useContext, ReactNode } from 'react';
import { useWorkspace as useWorkspaceHook } from '../hooks/useWorkspace';
import type { Workspace } from '../types/workspace';

interface WorkspaceContextValue {
  workspace: Workspace | null;
  workspacePath: string;
  isLoading: boolean;
  error: Error | null;
  updateBlock: (id: string, content: string | null, metadata: Record<string, any> | null) => Promise<void>;
  createBlock: (content: string, metadata: Record<string, any>) => Promise<string>;
  deleteBlock: (id: string) => Promise<void>;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const workspaceValue = useWorkspaceHook();
  
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

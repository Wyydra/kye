import { createContext, useContext } from 'react';
import { TemplateDto } from '../types/workspace';

interface WorkspaceContextValue {
  workspacePath: string;
  templates: TemplateDto[];
  refresh: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspacePath: '',
  templates: [],
  refresh: () => {},
});

// Targeted selectors — prefer these for performance
export const useWorkspacePath = () => useContext(WorkspaceContext).workspacePath;
export const useTemplates = () => useContext(WorkspaceContext).templates;

// Full context accessor — mirrors the original codebase pattern
export const useWorkspace = () => useContext(WorkspaceContext);

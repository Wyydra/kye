import { createContext, useContext } from 'react';

export const WorkspaceContext = createContext<string>('');

export function useWorkspace() {
    return useContext(WorkspaceContext);
}

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Workspace } from '../types/workspace';

export interface WorkspaceService {
  getWorkspace(): Promise<Workspace>;
  getWorkspacePath(): Promise<string>;
  getBlockTypes(): Promise<string[]>;
  createBlock(content: string, metadata: string): Promise<[Workspace, string]>;
  updateBlock(id: string, content: string | null, metadata: string | null): Promise<Workspace>;
  deleteBlock(id: string): Promise<Workspace>;
  onWorkspaceUpdated(callback: () => void): Promise<() => void>;
}

export const workspaceService: WorkspaceService = {
  async getWorkspace() {
    return await invoke<Workspace>('get_workspace');
  },

  async getWorkspacePath() {
    return await invoke<string>('get_workspace_path');
  },

  async getBlockTypes() {
    return await invoke<string[]>('get_block_types');
  },

  async createBlock(content: string, metadata: string) {
    return await invoke<[Workspace, string]>('create_block', { content, metadata });
  },

  async updateBlock(id: string, content: string | null, metadata: string | null) {
    return await invoke<Workspace>('update_block', { id, content, metadata });
  },

  async deleteBlock(id: string) {
    return await invoke<Workspace>('delete_block', { id });
  },

  async onWorkspaceUpdated(callback: () => void) {
    const unlisten = await listen('workspace_updated', callback);
    return unlisten;
  }
};

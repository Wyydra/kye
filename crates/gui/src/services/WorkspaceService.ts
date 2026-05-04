import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Workspace, TemplateDto } from '../types/workspace';

export interface WorkspaceService {
  getWorkspace(): Promise<Workspace>;
  getWorkspacePath(): Promise<string>;
  getBlockTypes(): Promise<string[]>;
  getTemplates(): Promise<TemplateDto[]>;
  identifyBlockShapes(metadata: string): Promise<string[]>;
  createBlock(content: string, metadata: string): Promise<[Workspace, string]>;
  updateBlock(id: string, content: string | null, metadata: string | null): Promise<Workspace>;
  deleteBlock(id: string): Promise<Workspace>;
  onWorkspaceUpdated(callback: () => void): Promise<() => void>;
  selectWorkspaceFolder(): Promise<string>;
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

  async getTemplates() {
    return await invoke<TemplateDto[]>('get_templates');
  },

  async identifyBlockShapes(metadata: string) {
    return await invoke<string[]>('identify_block_shapes', { metadata });
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
    return await listen('workspace_updated', callback);
  },

  async selectWorkspaceFolder() {
    return await invoke<string>('select_workspace_folder');
  }
};

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { Workspace, TemplateDto, TypeDefinitionDto } from '../types/workspace';

export interface WorkspaceService {
  getWorkspace(): Promise<Workspace>;
  getWorkspacePath(): Promise<string>;
  getBlockTypes(): Promise<string[]>;
  getTemplates(): Promise<TemplateDto[]>;
  identifyBlockShapes(fields: any): Promise<string[]>;
  createBlock(fields: any): Promise<[Workspace, string]>;
  updateBlock(id: string, fields: any): Promise<Workspace>;
  deleteBlock(id: string): Promise<Workspace>;
  onWorkspaceUpdated(callback: () => void): Promise<() => void>;
  selectWorkspaceFolder(): Promise<string>;
  registerType(name: string, definition: TypeDefinitionDto): Promise<void>;
  deleteType(name: string): Promise<void>;
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

  async identifyBlockShapes(fields: any) {
    return await invoke<string[]>('identify_block_shapes', { metadata: JSON.stringify(fields) });
  },

  async createBlock(fields: any) {
    return await invoke<[Workspace, string]>('create_block', { content: "", metadata: JSON.stringify(fields) });
  },

  async updateBlock(id: string, fields: any) {
    return await invoke<Workspace>('update_block', { id, content: null, metadata: JSON.stringify(fields) });
  },

  async deleteBlock(id: string) {
    return await invoke<Workspace>('delete_block', { id });
  },

  async onWorkspaceUpdated(callback: () => void) {
    return await listen('workspace_updated', callback);
  },

  async selectWorkspaceFolder() {
    return await invoke<string>('select_workspace_folder');
  },

  async registerType(name: string, definition: TypeDefinitionDto) {
    return await invoke<void>('register_type', { name, definition });
  },

  async deleteType(name: string) {
    return await invoke<void>('delete_type', { name });
  }
};

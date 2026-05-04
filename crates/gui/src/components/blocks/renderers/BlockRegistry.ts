import React from 'react';
import { Block } from '../../../types/workspace';

export interface BlockRendererProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  isSelected: boolean;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onSelect: () => void;
  onRefresh: () => void;
}

type RendererComponent = React.ComponentType<BlockRendererProps>;

interface RegisteredBlock {
  html?: RendererComponent;
  svg?: RendererComponent;
  match: (block: Block, meta: any) => boolean;
  priority: number;
  getAnchor?: (block: Block, meta: any, nodeStates: Record<string, any>) => { x: number, y: number, width: number, height: number } | null;
}

class BlockRegistry {
  private renderers: RegisteredBlock[] = [];

  register(config: RegisteredBlock) {
    this.renderers.push(config);
    this.renderers.sort((a, b) => b.priority - a.priority);
  }

  findConfig(block: Block, meta: any): RegisteredBlock | null {
    return this.renderers.find(r => r.match(block, meta)) ?? null;
  }

  getRenderer(block: Block, layer: 'svg' | 'html'): RendererComponent | null {
    let meta = {};
    try { meta = JSON.parse(block.metadata); } catch {}
    
    const found = this.findConfig(block, meta);
    if (!found) return null;
    
    return layer === 'svg' ? (found.svg ?? null) : (found.html ?? null);
  }

  getAnchor(block: Block, nodeStates: Record<string, any>): { x: number, y: number, width: number, height: number } | null {
    let meta = {};
    try { meta = JSON.parse(block.metadata); } catch {}
    
    const found = this.findConfig(block, meta);
    if (found?.getAnchor) return found.getAnchor(block, meta, nodeStates);
    
    // Default anchor (standard node)
    const state = nodeStates[block.id];
    if (state) return { x: state.x, y: state.y, width: state.width, height: state.height };
    
    return null;
  }
}

export const blockRegistry = new BlockRegistry();

import React from 'react';
import { UniversalRenderer } from './UniversalRenderer';

export interface BlockRendererProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  isSelected: boolean;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onSelect: () => void;
  onRefresh: () => void;
  templates?: any[];
}

type RendererComponent = React.ComponentType<BlockRendererProps>;

interface RegisteredBlock {
  html?: RendererComponent;
  svg?: RendererComponent;
  match: (block: Block, meta: any) => boolean;
  priority: number;
  getAnchor?: (block: Block, meta: any, nodeStates: Record<string, any>) => { x: number, y: number, width: number, height: number } | null;
  editorMode?: 'popup' | 'inline' | 'auto';
}

class BlockRegistry {
  private renderers: RegisteredBlock[] = [];

  register(config: RegisteredBlock) {
    this.renderers.push(config);
    this.renderers.sort((a, b) => b.priority - a.priority);
  }

  findConfig(block: Block, meta: any, templates: any[] = []): RegisteredBlock | null {
    // 1. Try to find a dynamic template with a layout
    const primaryShape = block.shapes[0];
    const template = templates.find(t => t.name === primaryShape);
    
    if (template?.layout) {
      return {
        priority: 1000, // Very high priority for custom blueprints
        match: () => true,
        html: (props: BlockRendererProps) => {
            return React.createElement('div', {
                className: `w-full h-full flex flex-col overflow-hidden bg-card rounded-xl border shadow-sm transition-all ${props.isSelected ? 'border-primary ring-2 ring-primary/20' : ''} ${props.isEditing ? 'opacity-50' : ''}`,
                onClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    props.onSelect();
                },
                onDoubleClick: (e: React.MouseEvent) => {
                    e.stopPropagation();
                    props.setIsEditing(true);
                }
            }, React.createElement('div', { className: "flex-1 p-4 overflow-auto" }, 
                React.createElement(UniversalRenderer, {
                    blueprint: template.layout,
                    block: props.block,
                    metadata: meta,
                    onRefresh: props.onRefresh
                })
            ));
        }
      };
    }

    return this.renderers.find(r => r.match(block, meta)) ?? null;
  }

  getRenderer(block: Block, layer: 'svg' | 'html', templates: any[] = []): RendererComponent | null {
    let meta = {};
    try { meta = JSON.parse(block.metadata); } catch {}
    
    const found = this.findConfig(block, meta, templates);
    if (!found) return null;
    
    return layer === 'svg' ? (found.svg ?? null) : (found.html ?? null);
  }

  getAnchor(block: Block, nodeStates: Record<string, any>, templates: any[] = []): { x: number, y: number, width: number, height: number } | null {
    let meta = {};
    try { meta = JSON.parse(block.metadata); } catch {}
    
    const found = this.findConfig(block, meta, templates);
    if (found?.getAnchor) return found.getAnchor(block, meta, nodeStates);
    
    // Default anchor (standard node)
    const state = nodeStates[block.id];
    if (state) return { x: state.x, y: state.y, width: state.width, height: state.height };
    
    return null;
  }

  getEditorMode(block: Block, nodeStates: Record<string, any>, templates: any[] = []): 'popup' | 'inline' {
    let meta = {};
    try { meta = JSON.parse(block.metadata); } catch {}
    
    const found = this.findConfig(block, meta, templates);
    const mode = found?.editorMode ?? 'auto';

    if (mode === 'popup') return 'popup';
    if (mode === 'inline') return 'inline';

    // Auto logic
    const anchor = this.getAnchor(block, nodeStates, templates);
    if (!anchor || anchor.width < 150 || anchor.height < 100) return 'popup';
    
    return 'inline';
  }
}

export const blockRegistry = new BlockRegistry();

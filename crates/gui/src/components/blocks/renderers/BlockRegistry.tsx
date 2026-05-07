import React from 'react';
import { UniversalRenderer } from './UniversalRenderer';
import { Block, TemplateDto } from '../../types/workspace';

export interface BlockRendererProps {
  block: Block;
  layer: 'svg' | 'html';
  zoom?: number;
  isSelected: boolean;
  isEditing: boolean;
  setIsEditing: (val: boolean) => void;
  onSelect: () => void;
  onRefresh: () => void;
  templates?: TemplateDto[];
}

type RendererComponent = React.ComponentType<BlockRendererProps>;

export interface BlockFeatures {
  resizable?: boolean;
  connectable?: boolean;
  draggable?: boolean;
  toolbar?: boolean;
  selectionBorder?: boolean;
}

export interface RegisteredBlock {
  html?: RendererComponent;
  svg?: RendererComponent;
  match: (block: Block, fields: any) => boolean;
  priority: number;
  getAnchor?: (block: Block, fields: any, nodeStates: Record<string, any>) => { x: number, y: number, width: number, height: number } | null;
  editorMode?: 'popup' | 'inline' | 'auto';
  features?: BlockFeatures;
}

class BlockRegistry {
  private renderers: RegisteredBlock[] = [];

  register(config: RegisteredBlock) {
    this.renderers.push(config);
    this.renderers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Finds the best renderer configuration for a block.
   * Logic: 
   * 1. Collect all manual renderers that match.
   * 2. Collect all templates that match (via block.shapes).
   * 3. Return the one with the highest priority.
   */
  findConfig(block: Block, templates: TemplateDto[] = [], layer: 'svg' | 'html' = 'html'): RegisteredBlock | null {
    const candidates: RegisteredBlock[] = [...this.renderers.filter(r => r.match(block, block.fields))];

    // 2. Add the best matching template based on primary_shape
    if (layer === 'html') {
      const primaryTemplate = templates.find(t => t.name === block.primary_shape);
      if (primaryTemplate && primaryTemplate.layout) {
        candidates.push({
          priority: 100, // Templates have a base priority
          match: () => true,
          features: primaryTemplate.features,
          editorMode: 'auto',
          html: (props: BlockRendererProps) => (
            <div
              className={React.useMemo(() => `w-full h-full flex flex-col overflow-hidden bg-card rounded-xl border shadow-sm transition-all ${props.isSelected ? 'border-primary ring-2 ring-primary/20' : ''} ${props.isEditing ? 'opacity-50' : ''}`, [props.isSelected, props.isEditing])}
              onClick={(e) => { e.stopPropagation(); props.onSelect(); }}
            >
              <div className="flex-1 p-4 overflow-auto">
                  <UniversalRenderer
                    blueprint={primaryTemplate.layout!}
                    block={props.block}
                    metadata={props.block.fields}
                    onRefresh={props.onRefresh}
                  />
              </div>
            </div>
          )
        });
      }
    }

    if (candidates.length === 0) return null;

    // Sort by priority and return the winner
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }

  getRenderer(block: Block, layer: 'svg' | 'html', templates: TemplateDto[] = []): RendererComponent | null {
    const found = this.findConfig(block, templates, layer);
    if (!found) return null;
    
    return layer === 'svg' ? (found.svg ?? null) : (found.html ?? null);
  }

  getAnchor(block: Block, nodeStates: Record<string, any>, templates: TemplateDto[] = []): { x: number, y: number, width: number, height: number } | null {
    const found = this.findConfig(block, templates);
    if (found?.getAnchor) return found.getAnchor(block, block.fields, nodeStates);
    
    const state = nodeStates[block.id];
    if (state) return { x: state.x, y: state.y, width: state.width, height: state.height };
    
    return null;
  }

  getEditorMode(block: Block, nodeStates: Record<string, any>, templates: TemplateDto[] = []): 'popup' | 'inline' {
    const found = this.findConfig(block, templates);
    const mode = found?.editorMode ?? 'auto';

    if (mode === 'popup') return 'popup';
    if (mode === 'inline') return 'inline';

    const anchor = this.getAnchor(block, nodeStates, templates);
    if (!anchor || anchor.width < 150 || anchor.height < 100) return 'popup';
    
    return 'inline';
  }

  getFeatures(block: Block, templates: TemplateDto[] = []): BlockFeatures {
    const found = this.findConfig(block, templates);
    
    const defaults: BlockFeatures = {
      resizable: true,
      connectable: true,
      draggable: true,
      toolbar: true,
      selectionBorder: true
    };

    if (!found) return defaults;
    return { ...defaults, ...found.features };
  }
}

export const blockRegistry = new BlockRegistry();

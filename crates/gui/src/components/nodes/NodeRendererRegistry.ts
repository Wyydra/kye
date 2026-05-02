import React from 'react';

export interface NodeRendererProps {
  id: string;
  markdown: string;
  metadata?: Record<string, unknown>;
}

export interface NodeRenderer {
  view: React.ComponentType<NodeRendererProps>;
}

class RendererRegistry {
  private renderers: Map<string, NodeRenderer> = new Map();

  register(shape: string, renderer: NodeRenderer) {
    this.renderers.set(shape, renderer);
  }

  getRenderer(shapes: string[]): NodeRenderer | undefined {
    const specificShape = shapes.find(s => s !== 'text' && this.renderers.has(s));
    return this.renderers.get(specificShape ?? 'text');
  }
}

export const registry = new RendererRegistry();

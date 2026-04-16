import React from 'react';

export interface NodeRendererProps {
  id: string;
  markdown: string;
  metadata?: Record<string, any>;
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
    // Try to find the most specific renderer that matches a shape (excluding 'text' if others exist)
    const specificShape = shapes.find(s => s !== 'text' && this.renderers.has(s));
    if (specificShape) {
      return this.renderers.get(specificShape);
    }
    
    // Fallback to text if registered
    return this.renderers.get('text');
  }
}

export const registry = new RendererRegistry();

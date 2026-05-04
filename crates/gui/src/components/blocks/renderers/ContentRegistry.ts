import React from 'react';

export interface ContentRendererProps {
  id: string;
  markdown: string;
  metadata?: Record<string, unknown>;
}

export interface ContentRenderer {
  view: React.ComponentType<ContentRendererProps>;
}

class ContentRegistry {
  private renderers: Map<string, ContentRenderer> = new Map();

  register(shape: string, renderer: ContentRenderer) {
    this.renderers.set(shape, renderer);
  }

  getRenderer(shapes: string[]): ContentRenderer | undefined {
    const specificShape = shapes.find(s => s !== 'text' && this.renderers.has(s));
    return this.renderers.get(specificShape ?? 'text');
  }

  getRegisteredShapes(): string[] {
    return Array.from(this.renderers.keys());
  }
}

export const contentRegistry = new ContentRegistry();

import React from 'react';
import { WidgetBlueprint, Block } from '../../../types/workspace';

export interface WidgetProps {
  blueprint: WidgetBlueprint;
  block: Block;
  metadata: Record<string, any>;
  onRefresh: () => void;
  render: (bp: WidgetBlueprint) => React.ReactNode;
}

export type WidgetComponent = React.FC<WidgetProps>;

class WidgetRegistry {
  private widgets = new Map<string, WidgetComponent>();

  register(type: string, component: WidgetComponent) {
    this.widgets.set(type, component);
  }

  get(type: string): WidgetComponent | undefined {
    return this.widgets.get(type);
  }
}

export const widgetRegistry = new WidgetRegistry();

/**
 * Utility to resolve {{templates}} in strings using metadata
 */
export const resolveTemplate = (template: string | undefined, metadata: Record<string, any>): string => {
  if (!template) return "";
  if (!template.includes('{{')) return template;
  
  return template.replace(/\{\{(.+?)\}\}/g, (_, key) => {
    return String(metadata[key.trim()] || key);
  });
};

/**
 * Utility to resolve a property from either a binding or a static prop
 */
export const resolveProp = (blueprint: WidgetBlueprint, metadata: Record<string, any>, key: string): any => {
    const bindKey = blueprint.bindings[key];
    if (bindKey) return metadata[bindKey];
    return blueprint.props[key];
};

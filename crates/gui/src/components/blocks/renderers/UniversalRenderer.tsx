import React from 'react';
import { WidgetBlueprint, Block } from '../../../types/workspace';
import { widgetRegistry } from './WidgetRegistry';
import './widgets'; // Auto-register widgets

interface UniversalRendererProps {
  blueprint: WidgetBlueprint;
  block: Block;
  metadata: Record<string, any>;
  onRefresh: () => void;
}

export const UniversalRenderer: React.FC<UniversalRendererProps> = (props) => {
  const { blueprint } = props;
  
  const Widget = widgetRegistry.get(blueprint.type);
  
  if (!Widget) {
    return (
      <div className="p-2 border-2 border-dashed border-destructive/30 rounded-lg text-destructive text-xs font-mono bg-destructive/5">
        Unknown widget: <span className="font-bold">{blueprint.type}</span>
      </div>
    );
  }

  // Recursive render helper passed to widgets
  const renderChild = (childBp: WidgetBlueprint) => (
    <UniversalRenderer {...props} blueprint={childBp} />
  );

  return (
    <>
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>
      <Widget {...props} render={renderChild} />
    </>
  );
};

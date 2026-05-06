import React from 'react';
import { widgetRegistry } from '../WidgetRegistry';
import { cn } from '../../../../lib/utils';

widgetRegistry.register('stack', ({ blueprint, render }) => {
  const { direction = 'vertical' } = blueprint.props;
  
  return (
    <div className={cn(
      "flex gap-2 w-full",
      direction === 'horizontal' ? "flex-row items-center" : "flex-col"
    )}>
      {blueprint.children?.map((child, i) => (
        <React.Fragment key={i}>{render(child)}</React.Fragment>
      ))}
    </div>
  );
});

widgetRegistry.register('grid', ({ blueprint, render }) => {
  const { columns = 1 } = blueprint.props;
  
  return (
    <div 
      className="grid gap-2 w-full" 
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {blueprint.children?.map((child, i) => (
        <React.Fragment key={i}>{render(child)}</React.Fragment>
      ))}
    </div>
  );
});

import React, { useState } from 'react';
import { widgetRegistry } from '../WidgetRegistry';
import { cn } from '../../../../lib/utils';

widgetRegistry.register('flipCard', ({ blueprint, render }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const front = blueprint.slots.front;
  const back = blueprint.slots.back;

  if (!front || !back) return null;

  return (
    <div 
      className="relative w-full min-h-[150px] cursor-pointer perspective-1000 group"
      onClick={(e) => {
          e.stopPropagation();
          setIsFlipped(!isFlipped);
      }}
    >
      <div className={cn(
        "relative w-full h-full transition-all duration-500 preserve-3d min-h-[150px]",
        isFlipped ? "rotate-y-180" : ""
      )}>
        <div className="absolute inset-0 backface-hidden bg-card border rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-sm group-hover:border-primary/30 transition-colors">
          {render(front)}
        </div>
        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-primary/5 border-2 border-primary/20 rounded-xl p-6 flex flex-col items-center justify-center text-center shadow-inner">
          {render(back)}
        </div>
      </div>
    </div>
  );
});

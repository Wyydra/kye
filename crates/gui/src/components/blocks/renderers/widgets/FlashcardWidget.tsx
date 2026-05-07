import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { widgetRegistry, resolveProp } from '../WidgetRegistry';
import { cn } from '../../../../lib/utils';

widgetRegistry.register('flashcard', ({ blueprint, metadata }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const front = resolveProp(blueprint, metadata, 'front');
  const back = resolveProp(blueprint, metadata, 'back');

  return (
    <div 
      className="perspective-1000 w-full h-full cursor-pointer min-h-[180px]"
      onClick={(e) => {
        e.stopPropagation();
        setIsFlipped(!isFlipped);
      }}
    >
      <div className={cn(
        "relative w-full h-full transition-all duration-500 preserve-3d",
        isFlipped && "rotate-y-180"
      )}>
        {/* Front Side */}
        <div className="absolute inset-0 backface-hidden flex items-center justify-center p-8 rounded-xl border bg-card shadow-sm hover:border-primary/30 transition-colors">
          <div className="prose prose-sm dark:prose-invert max-w-none text-center">
            {front ? (
              <div className="text-lg font-medium opacity-90">
                <ReactMarkdown>{String(front)}</ReactMarkdown>
              </div>
            ) : (
              <span className="opacity-20 italic">Empty front</span>
            )}
          </div>
          <div className="absolute bottom-3 text-[8px] uppercase tracking-widest opacity-20 font-bold">
            Question
          </div>
        </div>

        {/* Back Side (Rotated) */}
        <div className="absolute inset-0 backface-hidden rotate-y-180 flex items-center justify-center p-8 rounded-xl border-2 border-primary/20 bg-primary/5 shadow-inner">
          <div className="prose prose-sm dark:prose-invert max-w-none text-center">
            {back ? (
              <div className="text-lg font-bold text-primary">
                <ReactMarkdown>{String(back)}</ReactMarkdown>
              </div>
            ) : (
              <span className="opacity-20 italic">Empty back</span>
            )}
          </div>
          <div className="absolute bottom-3 text-[8px] uppercase tracking-widest text-primary/40 font-bold">
            Answer
          </div>
        </div>
      </div>
    </div>
  );
});

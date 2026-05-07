import React from 'react';
import ReactMarkdown from 'react-markdown';
import { widgetRegistry, resolveTemplate, resolveProp } from '../WidgetRegistry';
import { cn } from '../../../../lib/utils';

widgetRegistry.register('text', ({ blueprint, metadata }) => {
  const value = resolveProp(blueprint, metadata, 'value');
  const displayValue = resolveTemplate(value, metadata);
  const style = blueprint.props.style;
  
  return (
    <span className={cn(
      "text-sm font-medium",
      style === 'header' && "text-xs font-black uppercase tracking-widest opacity-50",
      !displayValue && "opacity-30 italic"
    )}>
      {displayValue || "Empty text"}
    </span>
  );
});

widgetRegistry.register('markdown', ({ blueprint, metadata }) => {
  const mdContent = resolveProp(blueprint, metadata, 'value');
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none w-full">
      {mdContent ? (
          <ReactMarkdown>{String(mdContent)}</ReactMarkdown>
      ) : (
          <span className="opacity-30 italic text-xs">Empty (click to edit)</span>
      )}
    </div>
  );
});

import { memo } from 'react';

interface GridBackgroundProps {
  zoom: number;
  x: number;
  y: number;
}

export const GridBackground = memo(function GridBackground({ zoom, x, y }: GridBackgroundProps) {

  const size = 32 * zoom;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      zIndex: 0,
      overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern 
            id="dotGrid" 
            width={size} 
            height={size} 
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${x % size}, ${y % size})`}
          >
            <circle 
              cx={zoom} 
              cy={zoom} 
              r={Math.max(1, zoom)} 
              fill="currentColor" 
              className="text-muted-foreground/20"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotGrid)" />
      </svg>
    </div>
  );
});

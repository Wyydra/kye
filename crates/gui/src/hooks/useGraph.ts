import { useEffect, useRef, RefObject } from 'react';
import { Graph, Transform } from '@antv/x6';

export function useGraph(containerRef: RefObject<HTMLDivElement | null>): RefObject<Graph | null> {
  const graphRef = useRef<Graph | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      panning: true,
      mousewheel: true,
      grid: true,
      interacting: { nodeMovable: true },
    });

    graph.use(new Transform({ resizing: true, rotating: true }));

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, []);

  return graphRef;
}

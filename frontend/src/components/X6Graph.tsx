import { useLayoutEffect, useEffect, useRef } from 'react';
import { Graph } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { Snapline } from '@antv/x6-plugin-snapline';
import { KyeNodeComponent } from './nodes/KyeNode';
import { useWorkspace } from '../context/WorkspaceContext';
import { useX6Sync } from '../hooks/useX6Sync';

// Register the React shape for X6 using the official plugin method
register({
  shape: 'kye-node',
  width: 300,
  height: 120,
  component: KyeNodeComponent,
});

export const X6Graph = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const { updateBlock } = useWorkspace();
  const updateBlockRef = useRef(updateBlock);
  
  useEffect(() => {
    updateBlockRef.current = updateBlock;
  }, [updateBlock]);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const { clientWidth, clientHeight } = containerRef.current;

    const graph = new Graph({
      container: containerRef.current,
      width: clientWidth || 800,
      height: clientHeight || 600,
      background: {
        color: '#0f172a',
      },
      grid: {
        size: 10,
        visible: true,
        type: 'doubleMesh',
        args: [
          { color: 'rgba(255,255,255,0.05)', strokeWidth: 1 },
          { color: 'rgba(255,255,255,0.02)', strokeWidth: 1, factor: 4 },
        ],
      },
      mousewheel: {
        enabled: true,
        minScale: 0.2,
        maxScale: 2,
      },
      panning: true,
      connecting: {
        router: 'manhattan',
        connector: { name: 'smooth' },
        anchor: 'center',
        connectionPoint: 'anchor',
        allowBlank: false,
        snap: { radius: 20 },
      },
      autoResize: true,
    });

    // Use official Snapline plugin for alignment
    graph.use(new Snapline());

    graphRef.current = graph;

    // Registration is done globally at the top of the file

    // Double click to add node menu (simplified for now, menu handled in App.tsx)
    graph.on('blank:dblclick', ({ e, x, y }) => {
       // We can dispatch a custom event or use a state
       const event = new CustomEvent('x6:blank:dblclick', { 
         detail: { x: e.clientX, y: e.clientY, graphX: x, graphY: y } 
       });
       window.dispatchEvent(event);
    });

    // Node management handled by native html registration above
    
    return () => {
      graph.dispose();
    };
  }, []); // Only initialize once!

  // Use the sync hook to bridge Workspace state to X6 graph
  useX6Sync(graphRef);

    return (
      <div className="x6-graph-container" ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '100vh' }} />
    );
};

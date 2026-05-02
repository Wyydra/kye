import React, { useEffect, useRef } from 'react';
import { Graph, Transform } from '@antv/x6';
import * as X6ReactShape from '@antv/x6-react-shape';
import { Node } from './Node';
import { Workspace } from '../types/workspace';

const { register } = X6ReactShape;

register({
  shape: 'kye-node',
  width: 250,
  height: 120,
  effect: ['data'], // Crucial: Tell X6 to re-render the React component when node.setData() is called
  component: Node,
});

// For compatibility with both X6 v2 and v3
const PortalProvider = X6ReactShape.getProvider ? X6ReactShape.getProvider() : (X6ReactShape as any).Portal.getProvider();

interface CanvasProps {
  workspace: Workspace | null;
}

const Canvas: React.FC<CanvasProps> = ({ workspace }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  // 1. Initialize Graph strictly once
  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '';

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      panning: true,
      mousewheel: true,
      grid: true,
      interacting: {
        nodeMovable: true,
      },
    });

    graph.use(
      new Transform({
        resizing: true,
        rotating: true,
      }),
    )

    graphRef.current = graph;

    return () => {
      graph.dispose();
      graphRef.current = null;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  // 2. Synchronize Declarative Workspace State to Imperative Graph
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !workspace) return;

    const existingNodes = graph.getNodes();
    const existingNodeIds = new Set(existingNodes.map(n => n.id));
    const incomingBlockIds = new Set(workspace.blocks.map(b => b.id));

    // A. Remove nodes that are in the graph but no longer in the workspace
    existingNodes.forEach(node => {
      if (!incomingBlockIds.has(node.id)) {
        graph.removeNode(node.id);
      }
    });

    // B. Add or Update nodes
    workspace.blocks.forEach((block, index) => {
      if (existingNodeIds.has(block.id)) {
        // Update existing node data dynamically without screen tearing
        const node = graph.getCellById(block.id);
        if (node && node.isNode()) {
          node.setData(block);
        }
      } else {
        // Add new node. Try to read layout coords from metadata, fallback to staggered layout
        let x = 100 + (index % 4) * 280;
        let y = 100 + Math.floor(index / 4) * 150;

        try {
          const meta = JSON.parse(block.metadata);
          if (meta.x !== undefined) x = meta.x;
          if (meta.y !== undefined) y = meta.y;
        } catch (e) {
          // Ignore invalid metadata
        }

        graph.addNode({
          id: block.id,
          shape: 'kye-node',
          x,
          y,
          data: block,
        });
      }
    });
  }, [workspace]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#F2F7FA' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <PortalProvider />
    </div>
  );
};

export default Canvas;

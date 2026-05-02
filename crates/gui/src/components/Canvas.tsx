import React, { useRef } from 'react';
import * as X6ReactShape from '@antv/x6-react-shape';
import { KyeNode } from './nodes/KyeNode';
import { Workspace } from '../types/workspace';
import { useGraph } from '../hooks/useGraph';
import { useGraphSync } from '../hooks/useGraphSync';

const { register } = X6ReactShape;
const PortalProvider = X6ReactShape.getProvider
  ? X6ReactShape.getProvider()
  : (X6ReactShape as any).Portal.getProvider();

register({ shape: 'kye-node', width: 280, height: 160, effect: ['data'], component: KyeNode });

interface CanvasProps {
  workspace: Workspace | null;
}

const Canvas: React.FC<CanvasProps> = ({ workspace }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useGraph(containerRef);
  useGraphSync(graphRef, workspace);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0f0f1a' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <PortalProvider />
    </div>
  );
};

export default Canvas;

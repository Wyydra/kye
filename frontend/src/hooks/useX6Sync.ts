import { useEffect, useRef, type MutableRefObject } from 'react';
import { Graph, Node } from '@antv/x6';
import { useWorkspace } from '../context/WorkspaceContext';

export interface UseX6SyncProps {
  graphRef: MutableRefObject<Graph | null>;
}

export function useX6Sync(graphRef: MutableRefObject<Graph | null>) {
  const { workspace, updateBlock } = useWorkspace();
  const movingNodeRef = useRef<string | null>(null);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !workspace) return;

    // 1. Reconciliation: Add or Update nodes
    workspace.blocks.forEach((block, index) => {
      let metadata: Record<string, any> = {};
      try {
        if (block.metadata) {
          metadata = JSON.parse(block.metadata);
        }
      } catch (e) {
        console.warn("Invalid metadata JSON for block", block.id);
      }

      const existingNode = graph.getCellById(block.id) as Node;
      
      const position = metadata.position || {
        x: 50 + (index % 3) * 450,
        y: 50 + Math.floor(index / 3) * 250
      };

      if (!existingNode) {
        graph.addNode({
          id: block.id,
          shape: 'kye-node',
          x: position.x,
          y: position.y,
          data: {
            markdown: block.content,
            metadata,
            shapes: block.shapes,
          },
        });
      } else {
        // Update data if changed
        const currentData = existingNode.getData();
        if (currentData.markdown !== block.content || JSON.stringify(currentData.metadata) !== JSON.stringify(metadata)) {
          existingNode.setData({
            markdown: block.content,
            metadata,
            shapes: block.shapes,
          }, { overwrite: true });
        }

        // Update position from backend if not currently dragging
        if (movingNodeRef.current !== block.id) {
            const currentPos = existingNode.getPosition();
            // Use 1 pixel threshold to prevent jittering
            if (Math.abs(currentPos.x - position.x) > 1 || Math.abs(currentPos.y - position.y) > 1) {
                existingNode.setPosition(position.x, position.y);
            }
        }
      }
    });

    // 2. Reconciliation: Remove deleted nodes
    const blockIds = new Set(workspace.blocks.map(b => b.id));
    const allNodes = graph.getNodes();
    allNodes.forEach(node => {
      // Only remove our custom nodes if they are no longer in the workspace
      if (node.shape === 'kye-node' && !blockIds.has(node.id)) {
        graph.removeNode(node.id);
      }
    });

  }, [workspace, graphRef]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    // Handle node move events to sync back to backend
    const onNodeMoveStart = ({ node }: { node: Node }) => {
      movingNodeRef.current = node.id;
    };

    const onNodeMoved = ({ node }: { node: Node }) => {
      movingNodeRef.current = null;
      const pos = node.getPosition();
      const data = node.getData();
      
      const newMetadata = {
        ...(data.metadata || {}),
        position: { x: pos.x, y: pos.y },
      };
      
      updateBlock(node.id, null, newMetadata);
    };

    graph.on('node:move', onNodeMoveStart);
    graph.on('node:moved', onNodeMoved);

    return () => {
      graph.off('node:move', onNodeMoveStart);
      graph.off('node:moved', onNodeMoved);
    };
  }, [graphRef, updateBlock]);
}

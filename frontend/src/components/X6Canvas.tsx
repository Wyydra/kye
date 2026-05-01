import React, { useEffect, useRef } from 'react';
import { Graph, Node, Cell, Selection, Transform } from '@antv/x6';
import { register } from '@antv/x6-react-shape';
import { useWorkspace } from '../context/WorkspaceContext';
import { BlockNodeComponent } from './BlockNode';

// Register the premium block shape
register({
  shape: 'block-node',
  width: 280,
  height: 100,
  component: BlockNodeComponent,
});

interface X6CanvasProps {
  onPaneDoubleClick: (flowPos: { x: number; y: number }, screenPos: { x: number; y: number }) => void;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
}

export const X6Canvas: React.FC<X6CanvasProps> = ({ 
  onPaneDoubleClick,
  editingNodeId,
  setEditingNodeId
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);
  const { workspace, updateBlock } = useWorkspace();

  // Initialize Graph
  useEffect(() => {
    if (!containerRef.current) return;

    const graph = new Graph({
      container: containerRef.current,
      autoResize: true,
      background: {
        color: '#f1f5f9', // Background color matching the app
      },
      grid: {
        size: 20,
        visible: true,
        type: 'dot',
        args: {
          color: '#cbd5e1', // Dot color
          thickness: 2,
        },
      },
      mousewheel: {
        enabled: true,
        modifiers: ['ctrl', 'meta'],
        minScale: 0.2,
        maxScale: 3,
      },
      interacting: {
        nodeMovable: true,
      },
      panning: {
        enabled: true,
        eventTypes: ['leftMouseDown', 'mouseWheel']
      }
    });

    graph.use(
        new Selection({
          enabled: true,
          multiple: false,
          rubberband: true,
          showNodeSelectionBox: false,
        })
    );

    graph.use(
        new Transform({
          resizing: {
            enabled: true,
            minWidth: 200,
            minHeight: 100,
            preserveAspectRatio: false,
          },
        })
    );

    // CRITICAL FIX: Removed Scroller plugin which was conflicting with standard panning 
    // and corrupting the drag-and-drop coordinate matrix in v3.

    graphRef.current = graph;

    // Handle Resize strictly over the container
    const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            graph.resize(clientWidth, clientHeight);
        }
    });
    resizeObserver.observe(containerRef.current);

    // Events
    graph.on('blank:dblclick', ({ e, x, y }) => {
      onPaneDoubleClick({ x, y }, { x: e.clientX, y: e.clientY });
    });

    graph.on('node:dblclick', ({ node }) => {
       const data = node.getData();
       if (data && data.setEditing) {
           data.setEditing(true);
       }
    });

    graph.on('blank:click', () => {
      setEditingNodeId(null);
    });

    graph.on('node:moved', ({ node }) => {
      const { x, y } = node.position();
      const data = node.getData() || {};
      updateBlock(node.id, null, {
        ...(data.metadata || {}),
        position: { x, y },
      });
    });

    graph.on('node:resized', ({ node }) => {
        const { width, height } = node.size();
        const data = node.getData() || {};
        updateBlock(node.id, null, {
            ...(data.metadata || {}),
            size: { width, height }
        });
    });

    return () => {
      resizeObserver.disconnect();
      graph.dispose();
    };
  }, [onPaneDoubleClick, updateBlock, setEditingNodeId]);

  // Sync Nodes from Workspace
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !workspace) return;

    const currentCells = graph.getCells();
    const workspaceBlockIds = new Set(workspace.blocks.map(b => b.id));

    // Remove deleted nodes
    currentCells.forEach((cell: Cell) => {
      if (!workspaceBlockIds.has(cell.id)) graph.removeCell(cell);
    });

    // Create or update nodes
    workspace.blocks.forEach((block, index) => {
      let metadata: any = {};
      try { if (block.metadata) metadata = JSON.parse(block.metadata); } catch(e) {}

      const position = metadata.position || {
        x: 50 + (index % 3) * 320,
        y: 50 + Math.floor(index / 3) * 200
      };

      let size = metadata.size || { width: 280, height: 100 };
      size.width = Math.max(200, Math.min(size.width, 800));
      size.height = Math.max(100, Math.min(size.height, 1000));
      
      const isEditing = editingNodeId === block.id;

      const nodeData = { 
        markdown: block.content,
        metadata,
        shapes: block.shapes || [],
        isEditing,
        setEditing: (editing: boolean) => {
          if (editing) {
            setEditingNodeId(block.id);
          } else if (isEditing) {
            setEditingNodeId(null);
          }
        },
        updateContent: (newMd: string, newMeta: any) => {
          updateBlock(block.id, newMd, newMeta);
        }
      };

      const existingNode = graph.getCellById(block.id) as Node;
      
      if (existingNode) {
        // Only update data, X6 dictates position & size via user interaction!
        existingNode.setData(nodeData);
      } else {
        graph.addNode({
          id: block.id,
          shape: 'block-node',
          x: position.x,
          y: position.y,
          width: size.width,
          height: size.height,
          data: nodeData,
        });
      }
    });

    if (editingNodeId) {
      const activeNode = graph.getCellById(editingNodeId);
      if (activeNode) {
        activeNode.toFront();
      }
    }

  }, [workspace, editingNodeId, updateBlock, setEditingNodeId]);

  return (
    <div 
      ref={containerRef} 
      className="x6-canvas-container"
      style={{ width: '100%', height: '100%', overflow: 'hidden' }} 
    />
  );
};

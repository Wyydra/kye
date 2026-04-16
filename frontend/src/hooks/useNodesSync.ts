import { useState, useCallback, useEffect } from 'react';
import type { Node, Edge, OnNodesChange, OnEdgesChange, OnConnect, Connection } from '@xyflow/react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import type { Workspace } from '../types/workspace';

export interface UseNodesSyncProps {
  workspace: Workspace | null;
  editingNode: string | null;
  setEditingNode: (id: string | null) => void;
  onMarkdownChange: (id: string, newMarkdown: string) => void;
  onMetadataChange: (id: string, newMetadata: Record<string, any>) => void;
}

export function useNodesSync({ 
    workspace, 
    editingNode, 
    setEditingNode, 
    onMarkdownChange, 
    onMetadataChange 
}: UseNodesSyncProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge(params, eds));
  }, [setEdges]);

  useEffect(() => {
    if (!workspace) return;

    setNodes(currentNodes => {
      return workspace.blocks.map((block, index) => {
        let metadata: Record<string, any> = {};
        try {
          if (block.metadata) {
            metadata = JSON.parse(block.metadata);
          }
        } catch (e) {
          console.warn("Invalid metadata JSON for block", block.id);
        }

        const existingNode = currentNodes.find(n => n.id === block.id);
        const backendPosition = metadata.position;
        
        let position = existingNode ? existingNode.position : (backendPosition || {
          x: 50 + (index % 3) * 450,
          y: 50 + Math.floor(index / 3) * 250
        });

        // Sync to backend position if it changed and we're not dragging
        if (existingNode && backendPosition && !existingNode.dragging && (
          Math.abs(backendPosition.x - existingNode.position.x) > 0.1 || 
          Math.abs(backendPosition.y - existingNode.position.y) > 0.1
        )) {
          position = backendPosition;
        }

        return {
          id: block.id,
          type: 'kye-node',
          position,
          selected: existingNode?.selected || false,
          data: {
            markdown: block.content,
            metadata,
            shapes: block.shapes,
            isEditing: editingNode === block.id,
            onMarkdownChange,
            onMetadataChange,
            setEditing: (editing: boolean) => setEditingNode(editing ? block.id : null)
          }
        };
      });
    });
  }, [workspace, editingNode, onMarkdownChange, onMetadataChange, setEditingNode]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    setNodes,
    setEdges
  };
}

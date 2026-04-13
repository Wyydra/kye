import React, { useState, useCallback, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  ConnectionMode,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import type { Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { KyeNodeComponent } from './components/nodes/KyeNode'
import './components/nodes/TextNode' // Register Text renderer
import './components/nodes/ImageNode' // Register Image renderer
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import { useNodesSync } from './hooks/useNodesSync'
import { workspaceService } from './services/WorkspaceService'

const nodeTypes = {
  'kye-node': KyeNodeComponent,
}

function Flow() {
  const { 
    workspace, 
    updateBlock, 
    createBlock, 
    deleteBlock 
  } = useWorkspace()

  const [blockTypes, setBlockTypes] = useState<string[]>([])
  const [menu, setMenu] = useState<{ x: number, y: number, flowX: number, flowY: number } | null>(null)
  const [editingNode, setEditingNode] = useState<string | null>(null)
  
  const { screenToFlowPosition } = useReactFlow()

  const onMarkdownChange = useCallback((id: string, newMarkdown: string) => {
    updateBlock(id, newMarkdown, null)
  }, [updateBlock])

  const onMetadataChange = useCallback((id: string, newMetadata: Record<string, any>) => {
    updateBlock(id, null, newMetadata)
  }, [updateBlock])

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useNodesSync({
    workspace,
    editingNode,
    setEditingNode,
    onMarkdownChange,
    onMetadataChange
  })

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      await deleteBlock(node.id)
    }
  }, [deleteBlock])

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.detail === 2) { // Double click
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      
      workspaceService.getBlockTypes().then(types => {
        setBlockTypes(types)
        setMenu({
          x: event.clientX,
          y: event.clientY,
          flowX: flowPos.x,
          flowY: flowPos.y
        })
      }).catch(e => {
        console.error("Failed to fetch block types:", e)
      })
    } else {
      setMenu(null)
    }
  }, [screenToFlowPosition])

  const handleCreateBlock = async (type: string) => {
    if (!menu) return;
    
    try {
      const initialFields: Record<string, any> = {
        position: { x: menu.flowX, y: menu.flowY }
      };

      if (type === 'image') initialFields.url = ""; 
      if (type === 'port') { 
        initialFields.id = ""; 
        initialFields.parent = "";
      }
      
      const newBlockId = await createBlock('', initialFields);
      setEditingNode(newBlockId);
      setMenu(null);
    } catch (e) {
      console.error("Failed to create block:", e);
    }
  }

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    onMetadataChange(node.id, {
      ...(node.data?.metadata || {}),
      position: { x: node.position.x, y: node.position.y }
    });
  }, [onMetadataChange]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodesDelete={onNodesDelete}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        nodeTypes={nodeTypes}
        zoomOnDoubleClick={false}
        fitView
      >
        <Background />
      </ReactFlow>
      
      {menu && (
        <div 
          className="add-node-menu" 
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {blockTypes.map((type) => (
            <div 
              key={type}
              className={`add-node-menu-item ${type}`} 
              onClick={() => handleCreateBlock(type)}
            >
              <div className="add-node-menu-icon" />
              <span>{type.charAt(0).toUpperCase() + type.slice(1)} Block</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function App() {
    return (
        <ReactFlowProvider>
            <WorkspaceProvider>
                <Flow />
            </WorkspaceProvider>
        </ReactFlowProvider>
    )
}

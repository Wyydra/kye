import React, { useState, useCallback } from 'react'
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
import type { TemplateDto } from './types/workspace'

const nodeTypes = {
  'kye-node': KyeNodeComponent,
}

/** Generates a default empty fields object from the Rust TemplateDto */
function scaffoldFromTemplate(template: TemplateDto, position: { x: number; y: number }): Record<string, any> {
  const fields: Record<string, any> = { position };
  for (const field of template.fields) {
    // Ignore internal fields
    if (['id', 'position', 'title'].includes(field.name)) continue;
    switch (field.field_type) {
      case 'Boolean':  fields[field.name] = false; break;
      case 'Integer':
      case 'Float':    fields[field.name] = 0; break;
      case 'String':   fields[field.name] = ''; break;
      case 'Record':   fields[field.name] = {}; break;
      case 'List':     fields[field.name] = []; break;
      default:
        if (field.field_type.startsWith('Named:')) fields[field.name] = null;
        break;
    }
  }
  return fields;
}

function Flow() {
  const {
    workspace,
    templates,
    updateBlock,
    createBlock,
    deleteBlock,
    workspacePath,
    setWorkspacePath,
    selectWorkspace,
  } = useWorkspace()

  const [menu, setMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)
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
    onMetadataChange,
  })

  const onNodesDelete = useCallback(async (deletedNodes: Node[]) => {
    for (const node of deletedNodes) {
      try {
        await deleteBlock(node.id)
      } catch {
      }
    }
  }, [deleteBlock])

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    if (event.detail === 2) { // Double click
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: flowPos.x,
        flowY: flowPos.y,
      })
    } else {
      setMenu(null)
    }
  }, [screenToFlowPosition])

  const handleCreateBlock = async (template: TemplateDto) => {
    if (!menu) return;
    try {
      const fields = scaffoldFromTemplate(template, { x: menu.flowX, y: menu.flowY });
      const newBlockId = await createBlock('', fields);
      setEditingNode(newBlockId);
      setMenu(null);
    } catch {
      setMenu(null);
    }
  }

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    onMetadataChange(node.id, {
      ...(node.data?.metadata || {}),
      position: { x: node.position.x, y: node.position.y },
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
          {templates.map((template) => (
            <div
              key={template.name}
              className={`add-node-menu-item ${template.name}`}
              onClick={() => handleCreateBlock(template)}
            >
              <div className="add-node-menu-icon" />
              <span>{template.name.charAt(0).toUpperCase() + template.name.slice(1)} Block</span>
            </div>
          ))}
        </div>
      )}

      <div className="workspace-toolbar">
        <div className="workspace-path" title={workspacePath}>
          {workspacePath.split('/').pop() || 'No workspace'}
        </div>
        <button className="workspace-select-btn" onClick={selectWorkspace}>
          Open Folder
        </button>
      </div>

      {workspacePath === 'test_workspace' && (
        <div className="workspace-welcome-overlay">
          <div className="welcome-card">
             <h1>Welcome to Kye</h1>
             <p>Select a folder to start modeling your knowledge.</p>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button className="primary-btn" onClick={selectWorkspace}>
                 Pick a Folder
               </button>
               <button 
                 style={{ 
                   background: 'none', 
                   border: 'none', 
                   color: 'var(--color-text-muted)', 
                   fontSize: '12px', 
                   cursor: 'pointer',
                   textDecoration: 'underline'
                 }} 
                 onClick={() => setWorkspacePath('__dismissed__')}
               >
                 Maybe later, use default
               </button>
             </div>
          </div>
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

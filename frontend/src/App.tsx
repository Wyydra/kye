import { useState, useEffect, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  ConnectionMode,
} from '@xyflow/react'
import type { Node, Edge, Connection } from '@xyflow/react'
import { invoke } from '@tauri-apps/api/core'
import '@xyflow/react/dist/style.css'
import { TextNode } from './TextNode'
import { ImageNode } from './ImageNode'
import { WorkspaceContext } from './WorkspaceContext'

interface Block {
  id: string;
  content: string;
  metadata: string;
}

interface Workspace {
  name: string;
  blocks: Block[];
}

const nodeTypes = {
  'text-block': TextNode,
  'image-block': ImageNode
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspacePath, setWorkspacePath] = useState<string>('')
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  
  const updateTimeouts = useRef<Record<string, number>>({})

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds))
  }, [setEdges])

  const loadWorkspace = async () => {
    try {
      const [ws, path] = await Promise.all([
        invoke<Workspace>('get_workspace'),
        invoke<string>('get_workspace_path'),
      ])
      setWorkspace(ws)
      setWorkspacePath(path)
    } catch (e) {
      console.error("Failed to load workspace:", e)
    }
  }

  useEffect(() => {
    loadWorkspace()
  }, [])

  const onMarkdownChange = useCallback((id: string, newMarkdown: string) => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, markdown: newMarkdown }
          }
        }
        return node
      })
    )

    if (updateTimeouts.current[id]) {
      clearTimeout(updateTimeouts.current[id])
    }

    updateTimeouts.current[id] = window.setTimeout(async () => {
      try {
        await invoke('update_block', { id, content: newMarkdown })
      } catch (e) {
        console.error("Failed to sync block update to disk:", e)
      }
    }, 1000)

  }, [setNodes])

  useEffect(() => {
    if (!workspace) return

    const initialNodes: Node[] = workspace.blocks.map((block, index) => {
      let nodeType = 'text-block'; // Fallback par défaut
      
      try {
          if (block.metadata) {
              const meta = JSON.parse(block.metadata);
              
              // On génère la clé attendue (ex: "image-block")
              const targetType = meta.type ? `${meta.type}-block` : 'text-block';
              
              // Si ce composant a bien été enregistré dans notre dictionnaire `nodeTypes`, on l'utilise
              if (targetType in nodeTypes) {
                  nodeType = targetType;
              }
          }
      } catch(e) {
          console.warn("Invalid metadata JSON for block", block.id);
      }

      return {
        id: block.id,
        type: nodeType,
        position: {
          x: 50 + (index % 3) * 450,
          y: 50 + Math.floor(index / 3) * 250
        },
        data: {
          markdown: block.content,
          onMarkdownChange
        }
      }
    })

    setNodes(initialNodes)
  }, [workspace, setNodes, onMarkdownChange])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <WorkspaceContext.Provider value={workspacePath}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          connectionMode={ConnectionMode.Loose}
          nodeTypes={nodeTypes}
          fitView
        >
          <Background />
        </ReactFlow>
      </WorkspaceContext.Provider>
    </div>
  )
}

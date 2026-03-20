import { useState, useEffect, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { invoke } from '@tauri-apps/api/core'
import '@xyflow/react/dist/style.css'
import { KyeNode } from './KyeNode'

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
  'kye-block': KyeNode
}

export default function App() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, , onEdgesChange] = useEdgesState<Edge>([])

  const loadWorkspace = async () => {
    try {
      const ws = await invoke<Workspace>('get_workspace')
      console.log("Loaded workspace:", ws)
      setWorkspace(ws)
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
    // Here we could also invoke a tauri command to save the block
    console.log(`Block ${id} content updated:`, newMarkdown)
  }, [setNodes])

  useEffect(() => {
    if (!workspace) return

    const initialNodes: Node[] = workspace.blocks.map((block, index) => ({
      id: block.id,
      type: 'kye-block',
      position: {
        x: 50 + (index % 3) * 450,
        y: 50 + Math.floor(index / 3) * 250
      },
      data: {
        markdown: block.content,
        onMarkdownChange
      }
    }))

    setNodes(initialNodes)
  }, [workspace, setNodes, onMarkdownChange])

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

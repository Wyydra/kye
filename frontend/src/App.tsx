import { useState, useCallback } from 'react'
import { X6Canvas } from './components/X6Canvas'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import type { TemplateDto } from './types/workspace'
import { getProvider } from '@antv/x6-react-shape'

const X6ReactPortalProvider = getProvider()

/** Generates a default empty fields object from the Rust TemplateDto */
function scaffoldFromTemplate(template: TemplateDto, position: { x: number; y: number }): Record<string, any> {
  const fields: Record<string, any> = { position };
  for (const field of template.fields) {
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
    templates,
    createBlock,
    workspacePath,
    setWorkspacePath,
    selectWorkspace,
  } = useWorkspace()

  const [menu, setMenu] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null)
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)

  const onPaneDoubleClick = useCallback((flowPos: { x: number; y: number }, screenPos: { x: number; y: number }) => {
    setMenu({
      x: screenPos.x,
      y: screenPos.y,
      flowX: flowPos.x,
      flowY: flowPos.y,
    })
  }, [])

  const handleCreateBlock = async (template: TemplateDto) => {
    if (!menu) return;
    try {
      const fields = scaffoldFromTemplate(template, { x: menu.flowX, y: menu.flowY });
      const newBlockId = await createBlock('', fields);
      setEditingNodeId(newBlockId);
      setMenu(null);
    } catch {
      setMenu(null);
    }
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }} onClick={() => setMenu(null)}>
      <X6Canvas 
        onPaneDoubleClick={onPaneDoubleClick}
        editingNodeId={editingNodeId}
        setEditingNodeId={setEditingNodeId}
      />

      {menu && (
        <div
          className="add-node-menu"
          style={{ top: menu.y, left: menu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="menu-header">Create Block</div>
          {templates.map((template) => (
            <div
              key={template.name}
              className={`add-node-menu-item ${template.name}`}
              onClick={() => handleCreateBlock(template)}
            >
              <div className="add-node-menu-icon" />
              <span>{template.name.charAt(0).toUpperCase() + template.name.slice(1)}</span>
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
    <WorkspaceProvider>
      <X6ReactPortalProvider />
      <Flow />
    </WorkspaceProvider>
  )
}

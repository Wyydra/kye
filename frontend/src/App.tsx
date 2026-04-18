import { useState, useEffect, useCallback } from 'react'
import { X6Graph } from './components/X6Graph'
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext'
import type { TemplateDto } from './types/workspace'

function Flow() {
  const {
    templates,
    createBlock,
    workspacePath,
    setWorkspacePath,
    selectWorkspace,
  } = useWorkspace()

  const [menu, setMenu] = useState<{ x: number; y: number; graphX: number; graphY: number } | null>(null)

  useEffect(() => {
    const handleDblClick = (e: any) => {
      setMenu({
        x: e.detail.x,
        y: e.detail.y,
        graphX: e.detail.graphX,
        graphY: e.detail.graphY,
      });
    };

    window.addEventListener('x6:blank:dblclick', handleDblClick);
    return () => window.removeEventListener('x6:blank:dblclick', handleDblClick);
  }, []);

  const handleCreateBlock = async (_template: TemplateDto) => {
    if (!menu) return;
    try {
      // Create block with position from the graph
      await createBlock('', { 
        position: { x: menu.graphX, y: menu.graphY } 
      });
      setMenu(null);
    } catch (err) {
      console.error("Failed to create block", err);
      setMenu(null);
    }
  }

  const closeMenu = useCallback(() => setMenu(null), []);

  return (
    <div style={{ width: '100vw', height: '100vh' }} onClick={closeMenu}>
      <X6Graph />

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
    <WorkspaceProvider>
      <Flow />
    </WorkspaceProvider>
  )
}

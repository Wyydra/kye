import { memo } from 'react';
import type { Node } from '@antv/x6';
import { TiptapEditor } from '../editors/TiptapEditor';
import { useWorkspace } from '../../context/WorkspaceContext';
import { LucideIcon, Brain, FileText, Settings, HelpCircle, X } from 'lucide-react';

export interface KyeNodeProps {
  node: Node;
  updateBlock?: (id: string, markdown: string | null, metadata: Record<string, any> | null) => Promise<void>;
}

export const KyeNodeComponent = memo(function KyeNodeComponent({ node, updateBlock: updateBlockProp }: KyeNodeProps) {
  const data = node.getData();
  const { shapes = ['text'], markdown = '', metadata = {} } = data;
  const isEditing = data.isEditing || false;
  
  const { updateBlock: workspaceUpdateBlock } = useWorkspace() || {};
  const updateBlock = updateBlockProp || workspaceUpdateBlock;

  // Determine Icon based on primary shape
  const primaryType = shapes.find((s: string) => s !== 'text') || 'text';
  const Icon = primaryType === 'llm' ? Brain : (primaryType === 'code' ? Settings : FileText);

  const setEditing = (editing: boolean) => {
    node.setData({ isEditing: editing });
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    node.remove();
  };

  return (
    <div className={`agent-card ${primaryType} ${isEditing ? 'is-editing' : ''}`}>
      <div className="header">
        <div className="icon">
          <Icon size={16} />
        </div>
        <div className="title">
          {metadata.title || primaryType.toUpperCase()}
        </div>
        <div className="actions">
          <span className="op" onClick={() => setEditing(!isEditing)} title="Edit">
            {isEditing ? '✓' : '✎'}
          </span>
          <span className="op" onClick={onDelete} title="Delete">
            <X size={14} />
          </span>
        </div>
      </div>

      <div className="body-content" style={{ flexGrow: 1, overflow: 'hidden' }}>
        {isEditing ? (
          <div 
            className="tiptap-container" 
            onKeyDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <TiptapEditor
              initialValue={markdown}
              onChange={(newMd) => updateBlock?.(node.id, newMd, null)}
              readOnly={false}
              clickCoords={null}
            />
          </div>
        ) : (
          <div className="desc" onDoubleClick={() => setEditing(true)}>
             {markdown || "No content..."}
          </div>
        )}
      </div>
    </div>
  );
});

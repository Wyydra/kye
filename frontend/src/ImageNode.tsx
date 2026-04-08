import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useWorkspace } from './WorkspaceContext'

export type ImageNodeData = {
    markdown: string;
    [key: string]: unknown;
}

export type ImageNode = Node<ImageNodeData, 'image-block'>;

const PLACEHOLDER = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%23e2e8f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23475569' font-family='sans-serif' font-size='16'>Image</text></svg>`;

function resolveImageUrl(markdown: string, workspacePath?: string): string {
    // Try markdown image format: ![alt](path)
    const match = markdown.match(/!\[.*?\]\((.*?)\)/);
    const raw = match?.[1] ?? (markdown.trim().startsWith('http') ? markdown.trim() : null);

    if (!raw) return PLACEHOLDER;

    // Absolute URL → use as-is
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;

    // Relative path → resolve against workspace and use asset protocol
    if (workspacePath) {
        const separator = workspacePath.endsWith('/') ? '' : '/';
        const absolutePath = `${workspacePath}${separator}${raw.replace(/^\.\//, '')}`;
        return convertFileSrc(absolutePath);
    }

    return PLACEHOLDER;
}

export function ImageNode({ data, selected }: NodeProps<ImageNode>) {
    const workspacePath = useWorkspace();
    const imageUrl = resolveImageUrl(data.markdown, workspacePath);

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={150} minHeight={150} color="#3b82f6" />
            <div className={`kye-node ${selected ? 'is-selected' : ''}`} style={{ padding: '4px' }}>
                <Handle type="source" position={Position.Top} id="top" className="kye-node-handle" />
                <Handle type="source" position={Position.Right} id="right" className="kye-node-handle" />
                
                <div className={`kye-node-content ${selected ? "nodrag nopan" : ""}`} style={{ display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                    <img 
                      src={imageUrl} 
                      alt="Node content" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} 
                      draggable={false}
                      onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
                    />
                </div>
                
                <Handle type="source" position={Position.Bottom} id="bottom" className="kye-node-handle" />
                <Handle type="source" position={Position.Left} id="left" className="kye-node-handle" />
            </div>
        </>
    )
}

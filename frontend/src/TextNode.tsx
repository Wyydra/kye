import { useState, useEffect, memo } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { TiptapEditor } from './TiptapEditor'
import ReactMarkdown from 'react-markdown'

export type TextNodeData = {
    markdown: string;
    metadata?: Record<string, any>;
    onMarkdownChange?: (id: string, newMarkdown: string) => void;
    [key: string]: unknown;
}

export type TextNode = Node<TextNodeData, 'text-block'>;

export const TextNode = memo(function TextNode({ id, data, selected }: NodeProps<TextNode>) {
    const [isEditing, setIsEditing] = useState(false);
    const [clickCoords, setClickCoords] = useState<{ x: number, y: number } | null>(null);

    useEffect(() => {
        if (!selected) {
            setIsEditing(false);
        }
    }, [selected]);

    const onMarkdownChange = (newMd: string) => data.onMarkdownChange?.(id, newMd)
    const type = (data.metadata?.type as string) || 'text';

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={250} minHeight={150} color="#3b82f6" />
            <div className={`block-node block-type-${type} ${selected ? 'is-selected' : ''}`}>
                {type !== 'text' && (
                    <div className="block-type-badge">{type}</div>
                )}
                <Handle type="source" position={Position.Top} id="top" className="block-node-handle" />
                <Handle type="source" position={Position.Right} id="right" className="block-node-handle" />
                
                <div 
                    className={`block-node-content ${isEditing ? "nodrag nopan" : ""}`}
                    style={{ cursor: isEditing ? 'text' : 'pointer', userSelect: isEditing ? 'auto' : 'none' }}
                    onKeyDown={isEditing ? (e) => {
                        e.stopPropagation();
                        if (e.key === 'Escape') {
                            setIsEditing(false);
                        }
                    } : undefined}
                    onMouseDown={isEditing ? (e) => e.stopPropagation() : undefined}
                    onClick={isEditing ? (e) => e.stopPropagation() : undefined}
                    onDoubleClick={(e) => {
                        if (selected) {
                            setClickCoords({ x: e.clientX, y: e.clientY });
                            setIsEditing(true);
                        }
                    }}
                >
                    {isEditing ? (
                        <TiptapEditor
                            initialValue={data.markdown}
                            onChange={onMarkdownChange}
                            readOnly={false}
                            clickCoords={clickCoords}
                        />
                    ) : (
                        <div className="tiptap-container readonly" style={{ height: '100%', width: '100%' }}>
                            <div className="tiptap markdown-preview">
                                <ReactMarkdown>{data.markdown || ''}</ReactMarkdown>
                            </div>
                        </div>
                    )}
                </div>
                
                <Handle type="source" position={Position.Bottom} id="bottom" className="block-node-handle" />
                <Handle type="source" position={Position.Left} id="left" className="block-node-handle" />
            </div>
        </>
    )
});

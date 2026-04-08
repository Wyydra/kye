import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { TiptapEditor } from './TiptapEditor'
import ReactMarkdown from 'react-markdown'

export type TextNodeData = {
    markdown: string;
    onMarkdownChange?: (id: string, newMarkdown: string) => void;
    [key: string]: unknown;
}

export type TextNode = Node<TextNodeData, 'text-block'>;

export function TextNode({ id, data, selected }: NodeProps<TextNode>) {
    const onMarkdownChange = (newMd: string) => data.onMarkdownChange?.(id, newMd)

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={250} minHeight={150} color="#3b82f6" />
            <div className={`kye-node ${selected ? 'is-selected' : ''}`}>
                <Handle type="source" position={Position.Top} id="top" className="kye-node-handle" />
                <Handle type="source" position={Position.Right} id="right" className="kye-node-handle" />
                
                <div 
                    className={`kye-node-content ${selected ? "nodrag nopan" : ""}`}
                    style={{ cursor: selected ? 'text' : 'default', userSelect: 'auto' }}
                    onKeyDown={selected ? (e) => e.stopPropagation() : undefined}
                    onMouseDown={selected ? (e) => e.stopPropagation() : undefined}
                    onClick={selected ? (e) => e.stopPropagation() : undefined}
                >
                    {selected ? (
                        <TiptapEditor
                            initialValue={data.markdown}
                            onChange={onMarkdownChange}
                            readOnly={false}
                        />
                    ) : (
                        <div className="markdown-preview">
                            <ReactMarkdown>{data.markdown || '*Vide*'}</ReactMarkdown>
                        </div>
                    )}
                </div>
                
                <Handle type="source" position={Position.Bottom} id="bottom" className="kye-node-handle" />
                <Handle type="source" position={Position.Left} id="left" className="kye-node-handle" />
            </div>
        </>
    )
}

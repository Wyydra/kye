import { useState, useCallback } from 'react'
import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import ReactMarkdown from 'react-markdown'

export type KyeNodeData = {
    markdown: string;
    onMarkdownChange?: (id: string, newMarkdown: string) => void;
    [key: string]: unknown;
}

export type KyeNode = Node<KyeNodeData, 'kye-block'>;

export function KyeNode({ id, data }: NodeProps<KyeNode>) {
    const [isEditing, setIsEditing] = useState(false)
    const [text, setText] = useState(data.markdown)

    const onDoubleClick = useCallback(() => {
        setIsEditing(true)
    }, [])

    const onBlur = useCallback(() => {
        setIsEditing(false)
        if (data.onMarkdownChange) {
            data.onMarkdownChange(id, text)
        }
    }, [id, text, data])

    return (
        <div
            className="kye-node"
            style={{
                background: '#fff',
                border: '1px solid #ddd',
                borderRadius: 4,
                padding: 8,
                minWidth: 300,
                minHeight: 150,
                maxHeight: 400,
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Handle type="target" position={Position.Top} />

            {isEditing ? (
                <textarea
                    autoFocus
                    style={{
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        outline: 'none',
                        resize: 'none',
                        font: 'inherit',
                        flexGrow: 1
                    }}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={onBlur}
                />
            ) : (
                <div
                    onDoubleClick={onDoubleClick}
                    style={{
                        height: '100%',
                        overflowY: 'auto',
                        flexGrow: 1,
                        cursor: 'text'
                    }}
                >
                    <ReactMarkdown>{text}</ReactMarkdown>
                </div>
            )}

            <Handle type="source" position={Position.Bottom} />
        </div>
    )
}

import type { Node, NodeProps } from '@xyflow/react'
import { Handle, Position, NodeResizer } from '@xyflow/react'
import { RoughNodeWrapper } from './RoughNodeWrapper'
import { MilkdownEditor } from './MilkdownEditor'

export type KyeNodeData = {
    markdown: string;
    onMarkdownChange?: (id: string, newMarkdown: string) => void;
    [key: string]: unknown;
}

export type KyeNode = Node<KyeNodeData, 'kye-block'>;

export function KyeNode({ id, data, selected }: NodeProps<KyeNode>) {
    const onMarkdownChange = (newMd: string) => data.onMarkdownChange?.(id, newMd)
    const handleStyle = { background: selected ? '#3b82f6' : '#999', opacity: selected ? 1 : 0.5 };

    return (
        <>
            <NodeResizer isVisible={selected} minWidth={250} minHeight={150} color="#3b82f6" />
            <RoughNodeWrapper className="kye-node" backgroundColor="#fff" color="#444" selected={selected}>
                <Handle type="target" position={Position.Top} style={{ ...handleStyle, top: -5 }} />
                <div style={{ flexGrow: 1, overflow: 'auto', padding: '4px' }}>
                    <MilkdownEditor
                        key={id}
                        initialValue={data.markdown}
                        onChange={onMarkdownChange}
                        readOnly={!selected}
                    />
                </div>
                <Handle type="source" position={Position.Bottom} style={{ ...handleStyle, bottom: -5 }} />
            </RoughNodeWrapper>
        </>
    )
}

import { memo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useWorkspace } from '../../context/WorkspaceContext';
import { registry } from './NodeRendererRegistry';
import type { NodeRendererProps } from './NodeRendererRegistry';

const PLACEHOLDER = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%23e2e8f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23475569' font-family='sans-serif' font-size='16'>Image</text></svg>`;

function resolveImageUrl(metadata?: Record<string, any>, workspacePath?: string): string {
    const raw = metadata?.url;
    if (!raw) return PLACEHOLDER;
    const urlStr = String(raw);
    if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) return urlStr;
    if (workspacePath) {
        const separator = workspacePath.endsWith('/') ? '' : '/';
        const absolutePath = `${workspacePath}${separator}${urlStr.replace(/^\.\//, '')}`;
        return convertFileSrc(absolutePath);
    }
    return PLACEHOLDER;
}

const ImageViewer = memo(({ metadata }: NodeRendererProps) => {
    const { workspacePath } = useWorkspace();
    const imageUrl = resolveImageUrl(metadata, workspacePath);
    
    return (
        <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', height: '100%', width: '100%' }}>
            <img 
              src={imageUrl} 
              alt="Node content" 
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} 
              draggable={false}
              onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER }}
            />
        </div>
    );
});

// Register only the view component
registry.register('image', {
    view: ImageViewer
});

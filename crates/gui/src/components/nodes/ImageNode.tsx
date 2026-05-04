import { memo } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useWorkspacePath } from '../../context/WorkspaceContext';
import { registry } from './NodeRendererRegistry';
import type { NodeRendererProps } from './NodeRendererRegistry';

const PLACEHOLDER = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><rect width='400' height='300' fill='%23f5f5f5'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='%23a0a0a0' font-family='sans-serif' font-size='16'>Image</text></svg>`;

function resolveImageUrl(metadata: Record<string, unknown> | undefined, workspacePath: string): string {
  const raw = metadata?.url;
  if (!raw) return PLACEHOLDER;

  const urlStr = String(raw);
  if (urlStr.startsWith('http://') || urlStr.startsWith('https://')) return urlStr;

  if (workspacePath) {
    const sep = workspacePath.endsWith('/') ? '' : '/';
    return convertFileSrc(`${workspacePath}${sep}${urlStr.replace(/^\.\//, '')}`);
  }

  return PLACEHOLDER;
}

const ImageViewer = memo(function ImageViewer({ metadata }: NodeRendererProps) {
  const workspacePath = useWorkspacePath();
  const src = resolveImageUrl(metadata, workspacePath);

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <img
        src={src}
        alt="Node content"
        draggable={false}
        onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER; }}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', display: 'block' }}
      />
    </div>
  );
});

export const ImageNode = ImageViewer;

registry.register('image', { view: ImageViewer });

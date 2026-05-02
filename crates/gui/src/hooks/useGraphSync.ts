import { useEffect, RefObject } from 'react';
import { Graph } from '@antv/x6';
import { Block, Workspace } from '../types/workspace';

function getBlockLayout(block: Block, index: number) {
  try {
    const meta = JSON.parse(block.metadata);
    return {
      x: meta.x ?? 100 + (index % 4) * 300,
      y: meta.y ?? 100 + Math.floor(index / 4) * 180,
      width: meta.width ?? 280,
      height: meta.height ?? 160,
    };
  } catch {
    return {
      x: 100 + (index % 4) * 300,
      y: 100 + Math.floor(index / 4) * 180,
      width: 280,
      height: 160,
    };
  }
}

export function useGraphSync(
  graphRef: RefObject<Graph | null>,
  workspace: Workspace | null,
) {
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !workspace) return;

    const existingIds = new Set(graph.getNodes().map(n => n.id));
    const incomingIds = new Set(workspace.blocks.map(b => b.id));

    // Remove stale nodes
    graph.getNodes().forEach(node => {
      if (!incomingIds.has(node.id)) graph.removeNode(node.id);
    });

    // Add or update
    workspace.blocks.forEach((block, index) => {
      if (existingIds.has(block.id)) {
        graph.getCellById(block.id)?.setData(block);
      } else {
        graph.addNode({
          id: block.id,
          shape: 'kye-node',
          ...getBlockLayout(block, index),
          data: block,
        });
      }
    });
  }, [workspace]);

  // Handle Persistence on Move/Resize
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    const handleUpdate = async ({ node }: { node: any }) => {
      const block = node.getData() as Block;
      if (!block) return;

      const pos = node.getPosition();
      const size = node.getSize();

      let meta = {};
      try { meta = JSON.parse(block.metadata); } catch {}

      const newMeta = JSON.stringify({
        ...meta,
        x: Math.round(pos.x),
        y: Math.round(pos.y),
        width: Math.round(size.width),
        height: Math.round(size.height),
      });

      // Avoid redundant calls if nothing changed
      if (newMeta === block.metadata) return;

      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('update_block', {
          id: block.id,
          content: null,
          metadata: newMeta,
        });
      } catch (e) {
        console.error('Failed to save node layout:', e);
      }
    };

    graph.on('node:moved', handleUpdate);
    graph.on('node:resized', handleUpdate);

    return () => {
      graph.off('node:moved', handleUpdate);
      graph.off('node:resized', handleUpdate);
    };
  }, [graphRef]);
}

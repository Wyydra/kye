import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";
import { val } from "../types/domain";

let cachedWorkspacePath: string | null = null;

/**
 * Pure NodeId Asset Resolver Hook.
 * Accepts strictly an asset NodeId pointing to an asset node in the graph,
 * and resolves assetNode.props.target to a local Tauri asset URL.
 */
export function useAssetUrl(nodeId: string | undefined): string | null {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  const targetFile = useGraphStore((state) => {
    if (!nodeId) return null;
    const node = state.nodes[nodeId];
    if (!node) return null;
    return val<string>(node.props.target) || val<string>(node.props.url) || null;
  });

  useEffect(() => {
    if (!nodeId || !targetFile) {
      setAssetUrl(null);
      return;
    }

    let isMounted = true;

    const resolve = (rootPath: string) => {
      if (!isMounted) return;
      const fullPath = rootPath.endsWith("/") ? `${rootPath}${targetFile}` : `${rootPath}/${targetFile}`;
      setAssetUrl(convertFileSrc(fullPath));
    };

    if (cachedWorkspacePath) {
      resolve(cachedWorkspacePath);
    } else {
      kyeService
        .getWorkspacePath()
        .then((path) => {
          if (path) {
            cachedWorkspacePath = path;
            resolve(path);
          }
        })
        .catch(console.error);
    }

    return () => {
      isMounted = false;
    };
  }, [nodeId, targetFile]);

  return assetUrl;
}

import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";
import { val } from "../types/domain";

let cachedWorkspacePath: string | null = null;

/**
 * Universal Asset URL Resolver Hook.
 * Accepts a target URL (e.g. "sqlar://assets/...", "assets/...", "data:...")
 * OR a Node ID whose props.url contains the target URL string.
 */
export function useAssetUrl(urlOrNodeId: string | undefined): string | null {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  const resolvedTarget = useGraphStore((state) => {
    if (!urlOrNodeId) return null;
    const node = state.nodes[urlOrNodeId];
    if (node) {
      return val<string>(node.props.url) || val<string>(node.props.target) || null;
    }
    return urlOrNodeId;
  });

  useEffect(() => {
    if (!resolvedTarget) {
      setAssetUrl(null);
      return;
    }

    let isMounted = true;

    if (resolvedTarget.startsWith("sqlar://") || resolvedTarget.startsWith("sqlite://")) {
      kyeService
        .readAssetDataUrl(resolvedTarget)
        .then((dataUrl) => {
          if (isMounted) setAssetUrl(dataUrl);
        })
        .catch((err) => console.error("Failed to read sqlar asset url:", err));
      return;
    }

    if (resolvedTarget.startsWith("data:") || resolvedTarget.startsWith("http://") || resolvedTarget.startsWith("https://")) {
      setAssetUrl(resolvedTarget);
      return;
    }

    const resolve = (rootPath: string) => {
      if (!isMounted) return;
      const fullPath = rootPath.endsWith("/") ? `${rootPath}${resolvedTarget}` : `${rootPath}/${resolvedTarget}`;
      setAssetUrl(convertFileSrc(fullPath));
    };

    if (cachedWorkspacePath) {
      resolve(cachedWorkspacePath);
    } else {
      kyeService
        .getWorkspacePath()
        .then((path) => {
          if (path && isMounted) {
            cachedWorkspacePath = path;
            resolve(path);
          }
        })
        .catch(console.error);
    }

    return () => {
      isMounted = false;
    };
  }, [resolvedTarget]);

  return assetUrl;
}

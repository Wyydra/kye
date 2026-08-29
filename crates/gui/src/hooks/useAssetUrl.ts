import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";
import { val } from "../types/domain";

let cachedWorkspacePath: string | null = null;

/**
 * Universal Asset URL Resolver Hook.
 * Resolves local assets (SQLite sqlar, filesystem, remote URLs, or Graph node references)
 * into high-performance displayable URLs without triggering filesystem 500 errors on SQLite files.
 */
export function useAssetUrl(urlOrNodeId: string | undefined): string | null {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  const resolvedTarget = useGraphStore((state) => {
    if (!urlOrNodeId || urlOrNodeId.trim() === "") return null;

    // 1. If urlOrNodeId refers to an asset node in the graph:
    const node = state.nodes[urlOrNodeId];
    if (node) {
      return (
        val<string>(node.props.url) ||
        val<string>(node.props.target) ||
        val<string>(node.props.path) ||
        urlOrNodeId
      );
    }

    return urlOrNodeId;
  });

  useEffect(() => {
    if (!resolvedTarget || resolvedTarget.trim() === "") {
      setAssetUrl(null);
      return;
    }

    let isMounted = true;

    // 1. Direct HTTP / Base64 Data URLs
    if (
      resolvedTarget.startsWith("data:") ||
      resolvedTarget.startsWith("http://") ||
      resolvedTarget.startsWith("https://")
    ) {
      setAssetUrl(resolvedTarget);
      return;
    }

    // 2. Read through Kye backend (SQLite sqlar table, embedded workspace assets)
    kyeService
      .readAssetDataUrl(resolvedTarget)
      .then((dataUrl) => {
        if (isMounted && dataUrl) {
          setAssetUrl(dataUrl);
        }
      })
      .catch(() => {
        // 3. Fallback only for directory-based workspaces (NOT single-file SQLite .kye containers)
        if (!isMounted) return;

        const resolveLocalFile = (rootPath: string) => {
          if (!isMounted) return;

          // Single-file SQLite databases cannot be traversed as directories
          if (
            rootPath.endsWith(".kye") ||
            rootPath.endsWith(".sqlite") ||
            rootPath.endsWith(".db")
          ) {
            setAssetUrl(null);
            return;
          }

          const cleanTarget = resolvedTarget.replace(/^sqlar:\/\//, "").replace(/^sqlite:\/\//, "");
          const fullPath = rootPath.endsWith("/")
            ? `${rootPath}${cleanTarget}`
            : `${rootPath}/${cleanTarget}`;
          try {
            setAssetUrl(convertFileSrc(fullPath));
          } catch (e) {
            console.error("Failed to convert file src:", e);
            setAssetUrl(null);
          }
        };

        if (cachedWorkspacePath) {
          resolveLocalFile(cachedWorkspacePath);
        } else {
          kyeService
            .getWorkspacePath()
            .then((path) => {
              if (path && isMounted) {
                cachedWorkspacePath = path;
                resolveLocalFile(path);
              }
            })
            .catch(() => {
              if (isMounted) setAssetUrl(null);
            });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [resolvedTarget]);

  return assetUrl;
}

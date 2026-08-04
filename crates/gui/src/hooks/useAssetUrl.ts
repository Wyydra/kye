import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { kyeService } from "../services/kyeService";
import { useGraphStore } from "../store/graphStore";
import { val } from "../types/domain";

export function useAssetUrl(urlOrNodeId: string | undefined): string | null {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!urlOrNodeId) {
      setAssetUrl(null);
      return;
    }

    let resolvedPath = urlOrNodeId;
    const targetNode = useGraphStore.getState().nodes[urlOrNodeId];
    if (targetNode) {
      const targetProp = val<string>(targetNode.props.target) || val<string>(targetNode.props.url);
      if (targetProp) {
        resolvedPath = targetProp;
      }
    }

    let isMounted = true;

    kyeService
      .getWorkspacePath()
      .then((workspacePath) => {
        if (!isMounted || !workspacePath) return;

        const absolutePath = workspacePath.endsWith("/")
          ? `${workspacePath}${resolvedPath}`
          : `${workspacePath}/${resolvedPath}`;

        setAssetUrl(convertFileSrc(absolutePath));
      })
      .catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [urlOrNodeId]);

  return assetUrl;
}

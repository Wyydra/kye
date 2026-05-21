import { useState, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { kyeService } from "../services/kyeService";

export function useAssetUrl(url: string | undefined): string | null {
  const [assetUrl, setAssetUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!url) {
      setAssetUrl(null);
      return;
    }

    let isMounted = true;

    kyeService.getWorkspacePath().then((workspacePath) => {
      if (!isMounted || !workspacePath) return;

      const absolutePath = workspacePath.endsWith('/') 
        ? `${workspacePath}${url}`
        : `${workspacePath}/${url}`;

      setAssetUrl(convertFileSrc(absolutePath));
    }).catch(console.error);

    return () => {
      isMounted = false;
    };
  }, [url]);

  return assetUrl;
}

import { useState, useEffect } from "react";
import { getSignedUrl } from "@/lib/storage";

/**
 * Hook to get a signed URL for a file path.
 * Automatically refreshes when the path changes.
 * Returns null while loading or if there's an error.
 */
export function useSignedUrl(
  filePath: string | null | undefined,
  expiresIn: number = 86400 // 24 hours default
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!filePath) {
      setSignedUrl(null);
      return;
    }

    // If it's already a full URL (legacy or external), use it directly
    if (filePath.startsWith("http")) {
      setSignedUrl(filePath);
      return;
    }

    let isMounted = true;

    const fetchSignedUrl = async () => {
      const url = await getSignedUrl(filePath, expiresIn);
      if (isMounted) {
        setSignedUrl(url);
      }
    };

    fetchSignedUrl();

    return () => {
      isMounted = false;
    };
  }, [filePath, expiresIn]);

  return signedUrl;
}

/**
 * Hook to get signed URLs for multiple file paths.
 * Useful for displaying galleries of images.
 */
export function useSignedUrls(
  filePaths: (string | null | undefined)[],
  expiresIn: number = 86400
): (string | null)[] {
  const [signedUrls, setSignedUrls] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (!filePaths || filePaths.length === 0) {
      setSignedUrls([]);
      return;
    }

    let isMounted = true;

    const fetchSignedUrls = async () => {
      const urls = await Promise.all(
        filePaths.map(async (path) => {
          if (!path) return null;
          // If it's already a full URL, use it directly
          if (path.startsWith("http")) return path;
          return getSignedUrl(path, expiresIn);
        })
      );
      if (isMounted) {
        setSignedUrls(urls);
      }
    };

    fetchSignedUrls();

    return () => {
      isMounted = false;
    };
  }, [JSON.stringify(filePaths), expiresIn]);

  return signedUrls;
}

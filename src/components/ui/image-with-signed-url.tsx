import { useState, useEffect } from "react";
import { getSignedUrl } from "@/lib/storage";

interface ImageWithSignedUrlProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  path: string;
  expiresIn?: number;
}

/**
 * Image component that automatically fetches signed URL for storage paths.
 * If the path is already a full URL, it uses it directly.
 */
export function ImageWithSignedUrl({ 
  path, 
  expiresIn = 86400, 
  alt = "", 
  ...props 
}: ImageWithSignedUrlProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!path) {
      setSrc(null);
      return;
    }

    // If it's already a full URL (legacy), use it directly
    if (path.startsWith("http")) {
      setSrc(path);
      return;
    }

    // Get signed URL for the path
    let isMounted = true;
    getSignedUrl(path, expiresIn).then(url => {
      if (isMounted) setSrc(url);
    });

    return () => { isMounted = false; };
  }, [path, expiresIn]);

  if (!src) return null;

  return <img src={src} alt={alt} {...props} />;
}

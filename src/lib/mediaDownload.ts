/**
 * Utility functions for downloading media files
 */

/**
 * Convert a URL (HTTP or data URL) to a Blob
 */
export async function urlToBlob(url: string): Promise<Blob> {
  // Handle data URLs
  if (url.startsWith('data:')) {
    const response = await fetch(url);
    return response.blob();
  }
  
  // Handle HTTP URLs
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  return response.blob();
}

/**
 * Get file extension from URL or data URL
 */
export function getExtensionFromUrl(url: string, type: 'image' | 'video'): string {
  // Handle data URLs
  if (url.startsWith('data:')) {
    const mimeMatch = url.match(/^data:(\w+)\/(\w+)/);
    if (mimeMatch) {
      const ext = mimeMatch[2].toLowerCase();
      // Normalize common extensions
      if (ext === 'jpeg') return 'jpg';
      if (ext === 'quicktime') return 'mov';
      return ext;
    }
    return type === 'video' ? 'mp4' : 'jpg';
  }
  
  // Handle regular URLs
  try {
    const pathname = new URL(url).pathname;
    const ext = pathname.split('.').pop()?.toLowerCase();
    if (ext && ext.length <= 5 && /^[a-z0-9]+$/.test(ext)) {
      return ext;
    }
  } catch {
    // Invalid URL, fall through
  }
  
  return type === 'video' ? 'mp4' : 'jpg';
}

/**
 * Save a blob as a file download
 * Uses multiple fallback strategies for cross-browser compatibility
 */
export async function saveBlob(blob: Blob, filename: string): Promise<boolean> {
  // Strategy 1: Use showSaveFilePicker if available (Chrome/Edge)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'File',
          accept: { [blob.type || 'application/octet-stream']: [`.${filename.split('.').pop()}`] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    } catch (err: any) {
      // User cancelled or API failed, fall through to other strategies
      if (err?.name === 'AbortError') {
        return false; // User cancelled
      }
    }
  }
  
  // Strategy 2: Create object URL and trigger download
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  
  // Use click() with a slight delay to ensure it works
  link.click();
  
  // Cleanup after a delay
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 1000);
  
  return true;
}

/**
 * Download a single file from URL
 */
export async function downloadFile(url: string, filename: string): Promise<boolean> {
  try {
    const blob = await urlToBlob(url);
    return await saveBlob(blob, filename);
  } catch (error) {
    console.error('Download failed:', error);
    return false;
  }
}

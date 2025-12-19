import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SUPABASE_URL = "https://tkbsjtgrumhvwlxkmojg.supabase.co";

/**
 * Check if a string is already a full URL (not just a path)
 */
export function isFullUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Get a permanent public URL for a file in client-files bucket
 * This URL never expires as the bucket is public
 * @param filePath The path to the file in the bucket (or already a full URL)
 * @returns Permanent public URL
 */
export function getPublicUrl(filePath: string): string {
  if (!filePath) return "";
  
  // If it's already a full URL, return as-is
  if (isFullUrl(filePath)) return filePath;
  
  // Generate permanent public URL
  return `${SUPABASE_URL}/storage/v1/object/public/client-files/${filePath}`;
}

/**
 * Extract file path from a Supabase storage URL
 * Returns null if not a valid storage URL
 */
export function extractPathFromUrl(url: string): string | null {
  if (!isFullUrl(url)) return url; // Already a path
  
  const bucketMatch = url.match(/\/client-files\/(.+?)(?:\?|$)/);
  return bucketMatch ? bucketMatch[1] : null;
}

/**
 * Download a file as a Blob from client-files bucket
 * This bypasses domain blocking issues by fetching via authenticated API
 */
export async function downloadAsBlob(filePath: string): Promise<Blob | null> {
  // Handle legacy full URLs
  if (filePath.startsWith("http")) {
    const bucketMatch = filePath.match(/\/client-files\/(.+?)(?:\?|$)/);
    if (bucketMatch) {
      filePath = bucketMatch[1];
    } else {
      // External URL - try direct fetch
      try {
        const response = await fetch(filePath);
        return await response.blob();
      } catch (error) {
        console.error("Error fetching external URL:", error);
        return null;
      }
    }
  }

  const { data, error } = await supabase.storage
    .from("client-files")
    .download(filePath);

  if (error) {
    console.error("Error downloading file:", error);
    return null;
  }

  return data;
}

/**
 * Open a file in a new tab using blob URL
 */
export async function openFileInNewTab(
  filePath: string,
  showToast = true
): Promise<boolean> {
  if (showToast) {
    toast.info("Carregando arquivo...");
  }

  const blob = await downloadAsBlob(filePath);
  if (!blob) {
    toast.error("Erro ao carregar arquivo");
    return false;
  }

  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, "_blank");

  // Clean up URL after 2 minutes
  setTimeout(() => URL.revokeObjectURL(blobUrl), 120000);
  return true;
}

/**
 * Download a file to the user's device
 */
export async function downloadFile(
  filePath: string,
  fileName: string
): Promise<boolean> {
  toast.info("Iniciando download...");

  const blob = await downloadAsBlob(filePath);
  if (!blob) {
    toast.error("Erro ao baixar arquivo");
    return false;
  }

  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(blobUrl);
  toast.success("Download concluído");
  return true;
}

/**
 * Upload a file to the client-files bucket and return the file path
 * @param file The file to upload
 * @param folder The folder within client-files to store the file
 * @returns The file path (not URL) for later retrieval via signed URL
 */
export async function uploadToClientFiles(
  file: File,
  folder: string
): Promise<{ path: string; error: Error | null }> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${folder}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("client-files")
    .upload(fileName, file);

  if (uploadError) {
    return { path: "", error: uploadError };
  }

  return { path: fileName, error: null };
}

/**
 * Get a signed URL for a file in client-files bucket
 * @param filePath The path to the file in the bucket
 * @param expiresIn Expiration time in seconds (default 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  // If it's already a full URL (legacy), return as-is for backward compatibility
  if (filePath.startsWith("http")) {
    // For legacy URLs, try to extract path and create signed URL
    const bucketMatch = filePath.match(/\/client-files\/(.+)$/);
    if (bucketMatch) {
      filePath = bucketMatch[1];
    } else {
      return filePath; // External URL, return as-is
    }
  }

  const { data, error } = await supabase.storage
    .from("client-files")
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Get multiple signed URLs at once
 * @param filePaths Array of file paths
 * @param expiresIn Expiration time in seconds
 * @returns Array of signed URLs (null for any that failed)
 */
export async function getSignedUrls(
  filePaths: string[],
  expiresIn: number = 3600
): Promise<(string | null)[]> {
  return Promise.all(filePaths.map((path) => getSignedUrl(path, expiresIn)));
}

/**
 * Upload file and immediately get a signed URL for display
 * Useful for immediate preview after upload
 */
export async function uploadAndGetSignedUrl(
  file: File,
  folder: string,
  expiresIn: number = 3600
): Promise<{ path: string; signedUrl: string | null; error: Error | null }> {
  const { path, error } = await uploadToClientFiles(file, folder);
  
  if (error) {
    return { path: "", signedUrl: null, error };
  }

  const signedUrl = await getSignedUrl(path, expiresIn);
  return { path, signedUrl, error: null };
}

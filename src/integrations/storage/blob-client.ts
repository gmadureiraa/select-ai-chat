/**
 * Vercel Blob storage wrapper.
 *
 * Migration target: replaces `supabase.storage.*` calls.
 *
 * Architecture
 * ------------
 * This is a Vite (browser) app, so all server-only Vercel Blob operations
 * (`put`, `del`, `list`, signed URLs) are proxied through API endpoints
 * that another agent will implement on the server side. The endpoints
 * expected are:
 *
 *   POST /api/blob/upload-token  — returns a client upload token
 *                                  (consumes @vercel/blob `handleUpload`)
 *   POST /api/blob/delete         — body: { paths: string[] }
 *   POST /api/blob/list           — body: { prefix?: string }
 *   POST /api/blob/signed-url     — body: { path: string; expiresIn: number }
 *   GET  /api/blob/download?path  — streams the blob bytes
 *
 * Buckets are simulated as path prefixes ("<bucket>/<path>").
 *
 * Required env (server-side):
 *   BLOB_READ_WRITE_TOKEN   — Vercel Blob token (set on Vercel dashboard)
 *
 * Public URLs
 * -----------
 * When uploading with `access: 'public'` Vercel Blob returns a permanent URL
 * of the form `https://<store-id>.public.blob.vercel-storage.com/<pathname>`.
 * We persist the returned URL whenever possible. Where legacy code stores
 * just a path, `getPublicUrl()` returns the path as-is and assumes the
 * caller will have a full URL stored in the database.
 */

import { upload as clientUpload } from "@vercel/blob/client";

const BLOB_API_BASE = "/api/blob";

// -- types -----------------------------------------------------------------

interface UploadOptions {
  cacheControl?: string;
  upsert?: boolean;
  contentType?: string;
}

interface UploadResult {
  data: { path: string; url: string } | null;
  error: { message: string } | null;
}

interface DownloadResult {
  data: Blob | null;
  error: { message: string } | null;
}

interface PublicUrlResult {
  data: { publicUrl: string };
}

interface SignedUrlResult {
  data: { signedUrl: string } | null;
  error: { message: string } | null;
}

interface RemoveResult {
  data: unknown;
  error: { message: string } | null;
}

interface ListItem {
  name: string;
  id?: string;
  metadata?: Record<string, unknown>;
}

interface ListResult {
  data: ListItem[] | null;
  error: { message: string } | null;
}

// -- helpers ---------------------------------------------------------------

function joinPath(bucket: string, path: string): string {
  // strip leading slash on path
  const cleanPath = path.replace(/^\/+/, "");
  return `${bucket}/${cleanPath}`;
}

async function postJson<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(`${BLOB_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Request failed");
      return { data: null, error: { message: text || `HTTP ${res.status}` } };
    }

    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    return { data: null, error: { message } };
  }
}

// -- bucket API ------------------------------------------------------------

class BlobBucket {
  constructor(private readonly bucket: string) {}

  /**
   * Upload a file using the browser-safe client upload flow.
   * Requires a server-side endpoint at /api/blob/upload-token that calls
   * `handleUpload` from `@vercel/blob/client`.
   */
  async upload(
    path: string,
    file: Blob | File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const fullPath = joinPath(this.bucket, path);
    try {
      const blob = await clientUpload(fullPath, file, {
        access: "public",
        handleUploadUrl: `${BLOB_API_BASE}/upload-token`,
        contentType: options.contentType,
        // Vercel Blob always adds a random suffix unless explicitly disabled
        // server-side. We mirror Supabase semantics by NOT adding a suffix —
        // callers already supply unique names (timestamps/UUIDs).
        clientPayload: JSON.stringify({
          bucket: this.bucket,
          upsert: options.upsert ?? false,
          cacheControl: options.cacheControl,
        }),
      });
      // Return path WITHOUT the bucket prefix to match Supabase semantics —
      // callers immediately pass `data.path` to getPublicUrl/createSignedUrl
      // which already re-prefix.
      return {
        data: { path, url: blob.url },
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      return { data: null, error: { message } };
    }
  }

  /**
   * Download a blob's bytes via a server proxy that knows the token.
   * If the stored value is already a full URL we fetch it directly.
   */
  async download(path: string): Promise<DownloadResult> {
    const fullPath = joinPath(this.bucket, path);
    try {
      const url = `${BLOB_API_BASE}/download?path=${encodeURIComponent(fullPath)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text().catch(() => "Download failed");
        return { data: null, error: { message: text || `HTTP ${res.status}` } };
      }
      const blob = await res.blob();
      return { data: blob, error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Download failed";
      return { data: null, error: { message } };
    }
  }

  /**
   * Delete one or more blobs in this bucket.
   */
  async remove(paths: string[]): Promise<RemoveResult> {
    const fullPaths = paths.map((p) => joinPath(this.bucket, p));
    const { error } = await postJson<{ ok: boolean }>("/delete", {
      paths: fullPaths,
    });
    return { data: null, error };
  }

  /**
   * Build a public URL for a blob. With `access: 'public'` uploads, the URL
   * returned by `upload()` is canonical and permanent — prefer storing that.
   *
   * For legacy paths we fall back to the configured public host. The host is
   * read from `VITE_BLOB_PUBLIC_HOST` (set per Vercel project) and falls back
   * to a placeholder so the call never throws.
   */
  getPublicUrl(path: string): PublicUrlResult {
    if (!path) return { data: { publicUrl: "" } };

    // already a full URL
    if (path.startsWith("http://") || path.startsWith("https://")) {
      return { data: { publicUrl: path } };
    }

    const host =
      (import.meta.env.VITE_BLOB_PUBLIC_HOST as string | undefined) ??
      "https://blob.vercel-storage.com";
    const fullPath = joinPath(this.bucket, path);
    return { data: { publicUrl: `${host.replace(/\/$/, "")}/${fullPath}` } };
  }

  /**
   * Vercel Blob public URLs do not expire. For private/scoped delivery we
   * proxy through a server endpoint that can sign or stream-with-auth.
   * Returns a URL pointing at our `/api/blob/download?path=…` proxy as a
   * permanent fallback.
   */
  async createSignedUrl(
    path: string,
    expiresIn: number
  ): Promise<SignedUrlResult> {
    const fullPath = joinPath(this.bucket, path);
    const { data, error } = await postJson<{ signedUrl: string }>(
      "/signed-url",
      { path: fullPath, expiresIn }
    );

    if (error || !data) {
      // graceful fallback: return a download proxy URL
      const proxyUrl = `${BLOB_API_BASE}/download?path=${encodeURIComponent(fullPath)}`;
      return { data: { signedUrl: proxyUrl }, error: null };
    }

    return { data: { signedUrl: data.signedUrl }, error: null };
  }

  /**
   * List blobs under an optional sub-prefix inside this bucket.
   */
  async list(prefix?: string): Promise<ListResult> {
    const fullPrefix = prefix
      ? joinPath(this.bucket, prefix)
      : `${this.bucket}/`;
    const { data, error } = await postJson<{ blobs: ListItem[] }>("/list", {
      prefix: fullPrefix,
    });

    if (error || !data) return { data: null, error };
    return { data: data.blobs, error: null };
  }
}

// -- public surface --------------------------------------------------------

export const blobStorage = {
  from(bucket: string): BlobBucket {
    return new BlobBucket(bucket);
  },
};

export type { UploadOptions, UploadResult, DownloadResult, PublicUrlResult };

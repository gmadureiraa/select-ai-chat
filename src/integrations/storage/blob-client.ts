/**
 * Storage wrapper (Cloudflare R2 desde 2026-05-19).
 *
 * Migration target: replaces `supabase.storage.*` calls + Vercel Blob (que
 * foi suspenso em 19/05 por estourar quota 100MB free).
 *
 * Architecture
 * ------------
 * Vite (browser) app — operações server-only proxiadas via API endpoints:
 *
 *   POST /api/upload               — multipart/form-data com campo `file`
 *                                    e (opcional) `path` pro prefixo
 *   POST /api/blob/delete          — body: { paths: string[] }
 *   POST /api/blob/list            — body: { prefix?: string }
 *   POST /api/blob/signed-url      — body: { path: string; expiresIn: number }
 *   GET  /api/blob/download?path   — streams the blob bytes
 *
 * Buckets continuam simulados como prefixos ("<bucket>/<path>") — útil pra
 * código legado que ainda usa o pattern Supabase.
 *
 * Required env (server-side):
 *   R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_URL
 *
 * Public URLs
 * -----------
 * R2 com "Public Access" habilitado devolve URL `https://pub-XXX.r2.dev/<key>`.
 * Persistir a `url` retornada por `upload()` é o caminho recomendado — sem
 * expiração, sem proxy.
 */

import { getNeonAuthJWT } from "@/integrations/neon-auth/client";

const BLOB_API_BASE = "/api/blob";
const UPLOAD_ENDPOINT = "/api/upload";

/**
 * Pega o JWT do Neon Auth pra mandar como `Authorization: Bearer ...`.
 * O auth do server (api/_lib/auth.ts) só lê esse header — não lê cookie. Sem
 * isso todo upload caía em 401 silencioso (descoberto 2026-05-19 quando o user
 * reportou "Erro ao fazer upload de X" mesmo após R2 estar configurado).
 */
async function getAuthHeader(): Promise<Record<string, string>> {
  try {
    const token = await getNeonAuthJWT();
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // Fallback localStorage (mesmo padrão do apiInvoke)
    try {
      const raw =
        localStorage.getItem("kai-auth-token") ||
        localStorage.getItem("neon-auth-token");
      if (raw) return { Authorization: `Bearer ${raw}` };
    } catch {
      // ignore
    }
  }
  return {};
}

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
    const authHeader = await getAuthHeader();
    const res = await fetch(`${BLOB_API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader },
      credentials: "include",
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
   * Upload via POST multipart/form-data pro endpoint /api/upload (R2 server-side).
   * 2026-05-19: trocado o flow client upload do Vercel Blob (que precisava
   * de upload-token + ia direto pro Blob suspenso) por multipart simples.
   */
  async upload(
    path: string,
    file: Blob | File,
    _options: UploadOptions = {}
  ): Promise<UploadResult> {
    const form = new FormData();
    // Nome: se o file tem nome próprio (File), usa esse; senão deriva do path.
    const fileName =
      (file as File).name ||
      path.split("/").pop() ||
      `upload-${Date.now()}`;
    form.append("file", file, fileName);
    // Mantém o bucket+path como prefixo no R2 — preserva Supabase-like semantics
    // (callers passam `data.path` pra getPublicUrl que re-prefixa).
    const fullPathPrefix = joinPath(this.bucket, path)
      .split("/")
      .slice(0, -1)
      .join("/");
    if (fullPathPrefix) {
      form.append("path", fullPathPrefix);
    }

    try {
      const authHeader = await getAuthHeader();
      const res = await fetch(UPLOAD_ENDPOINT, {
        method: "POST",
        body: form,
        credentials: "include",
        headers: authHeader,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "Upload failed");
        return { data: null, error: { message: text || `HTTP ${res.status}` } };
      }
      const json = (await res.json()) as {
        url: string;
        path: string;
      };
      return {
        // path retornado sem bucket prefix (Supabase-like)
        data: { path, url: json.url },
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
      const authHeader = await getAuthHeader();
      const res = await fetch(url, {
        credentials: "include",
        headers: authHeader,
      });
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

    // 2026-05-19: padrão agora é R2 publicBase via VITE_R2_PUBLIC_URL.
    // VITE_BLOB_PUBLIC_HOST mantido como fallback retrocompat pra paths antigos
    // que ainda apontam pro Vercel Blob (esses vão 404 mas pelo menos não
    // crashea).
    const host =
      (import.meta.env.VITE_R2_PUBLIC_URL as string | undefined) ??
      (import.meta.env.VITE_BLOB_PUBLIC_HOST as string | undefined) ??
      "https://placeholder.invalid";
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

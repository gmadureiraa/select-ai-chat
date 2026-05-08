/**
 * apiInvoke — drop-in replacement for `apiInvoke('name', { body })`.
 *
 * Calls the equivalent Vercel Function at /api/<name>. Returns the same
 * `{ data, error }` shape so existing call sites work without changes.
 *
 * Auth: usa `getNeonAuthJWT()` (canonical helper do Neon Auth client) que
 * extrai o access_token via `neonAuth.getSession()` — funciona com qualquer
 * shape de session do SupabaseAuthAdapter (access_token / token / etc).
 *
 * Antes scaneava `localStorage` procurando key tipo `stack-auth*access*`
 * mas Stack Auth não usa esse padrão de nome — token nunca era encontrado
 * e todo POST autenticado caía pra 401 silencioso.
 */

import { getNeonAuthJWT } from "@/integrations/neon-auth/client";

interface InvokeOptions {
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface InvokeResult<T = any> {
  data: T | null;
  error: { message: string; status?: number; details?: any } | null;
}

async function getAuthToken(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const token = await getNeonAuthJWT();
    if (token) return token;
  } catch {
    // ignore — fall through to localStorage fallback
  }
  // Fallback de emergência (caso getSession falhe mas haja token cru)
  try {
    const kaiToken =
      localStorage.getItem("kai-auth-token") ||
      localStorage.getItem("neon-auth-token");
    if (kaiToken) return kaiToken;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Call a Vercel Function and return { data, error } shape compatible with
 * the old `supabase.functions.invoke` API.
 */
export async function apiInvoke<T = any>(name: string, options: InvokeOptions = {}): Promise<InvokeResult<T>> {
  const { body, headers = {}, signal } = options;
  const token = await getAuthToken();
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
    const contentType = res.headers.get('content-type') || '';
    let data: any = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      // SSE / text streams — return the response object so caller can read the body
      data = res;
    }
    if (!res.ok) {
      return {
        data: null,
        error: {
          message: data?.error || data?.message || `Request failed with status ${res.status}`,
          status: res.status,
          details: data,
        },
      };
    }
    return { data: data as T, error: null };
  } catch (err: any) {
    return { data: null, error: { message: err?.message || 'Network error' } };
  }
}

/**
 * Get a fetch Response for streaming endpoints (SSE). Use when you need the
 * raw Response (e.g. to read the body as a stream).
 */
export async function apiInvokeStream(name: string, options: InvokeOptions = {}): Promise<Response> {
  const { body, headers = {}, signal } = options;
  const token = await getAuthToken();
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  return fetch(`/api/${name}`, {
    method: 'POST',
    headers: reqHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
}

/**
 * apiInvoke — drop-in replacement for `apiInvoke('name', { body })`.
 *
 * Calls the equivalent Vercel Function at /api/<name>. Returns the same
 * `{ data, error }` shape so existing call sites work without changes.
 *
 * Auth: tries to attach the Neon Auth JWT from localStorage (Stack Auth).
 * Falls back to no-auth for endpoints that don't require it.
 */

interface InvokeOptions {
  body?: any;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

interface InvokeResult<T = any> {
  data: T | null;
  error: { message: string; status?: number; details?: any } | null;
}

function getAuthToken(): string | null {
  // Neon Auth (Stack Auth) stores JWT in localStorage. Try common keys.
  // Adjust if Auth agent uses a different key.
  if (typeof window === 'undefined') return null;
  try {
    // Stack Auth uses keys like "stack-auth.user.<projectId>"
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('stack-auth') && k.includes('access')) {
        const v = localStorage.getItem(k);
        if (v && v.length > 20 && v.split('.').length === 3) return v.replace(/^"|"$/g, '');
      }
    }
    // Common alternative: kai-auth-token
    const kaiToken = localStorage.getItem('kai-auth-token') || localStorage.getItem('neon-auth-token');
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
  const token = getAuthToken();
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
  const token = getAuthToken();
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

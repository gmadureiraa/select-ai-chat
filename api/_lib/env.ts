// env.ts — helpers defensivos pra ler process.env.
//
// Problema histórico (2026-05-16): valores em prod foram salvos com `\n`
// trailing (efeito colateral do `vercel env pull` em algum ponto, depois
// re-uploaded como string com `\n` literal). Quando interpretados pelo
// runtime, viram strings com newline real — Apify/Metricool aceitam mas
// URLs concatenadas (`${base}/path`) e tokens em headers HTTP quebram.
//
// SEMPRE use `getEnv()` ou `getEnvOrThrow()` em vez de `process.env.X`
// quando o valor for usado em requests externos ou em URLs.

const ENV_TRAILING_NEWLINE_RE = /\s+$/;

/**
 * Read an env var with whitespace/newline trimmed. Returns null when missing
 * or empty after trim.
 */
export function getEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/\\n/g, '').replace(ENV_TRAILING_NEWLINE_RE, '');
  return cleaned || null;
}

/**
 * Read first non-empty env var from a list (first match wins).
 * Returns null if none set.
 */
export function getEnvAny(...names: string[]): string | null {
  for (const n of names) {
    const v = getEnv(n);
    if (v) return v;
  }
  return null;
}

/**
 * Like getEnv but throws if missing — use for hard-required keys.
 */
export function getEnvOrThrow(name: string): string {
  const v = getEnv(name);
  if (!v) throw new Error(`${name} not configured`);
  return v;
}

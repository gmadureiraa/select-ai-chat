/**
 * Approval Flow — helper pra tools destrutivas/sensíveis do KAI Agent.
 *
 * Padrão: a tool é chamada uma 1ª vez SEM `approved: true`. Ela monta um
 * preview e devolve uma `ApprovalRequest` ao LLM/UI. O front mostra um
 * modal de confirmação. Se o usuário confirma, a UI re-executa a mesma tool
 * com `approved: true` + o mesmo `callbackToken`. O backend valida o token
 * (uso único, expira em 5min) e segue com a ação destrutiva real.
 *
 * MVP: store in-memory (`Map`). Funciona enquanto o approval e o re-call
 * caem na mesma instância de função Vercel (idle 5min ≈ mesma instância
 * em prática). Se virar problema (multi-region, cold starts) migra pra
 * tabela Postgres `approval_tokens` (id, action, payload jsonb, expires_at).
 *
 * Como usar em uma tool:
 *
 *   import { requireApproval, consumeApprovalToken } from '../approval-flow.js';
 *
 *   handler: async (args, ctx) => {
 *     const approved = args.approved === true;
 *     const token = typeof args.callbackToken === 'string' ? args.callbackToken : '';
 *
 *     if (!approved) {
 *       const approval = requireApproval({
 *         action: 'delete_content',
 *         preview: {
 *           title: 'Deletar carrossel?',
 *           description: `O carrossel "${title}" será removido permanentemente.`,
 *           impactedItems: [{ id, label: title }],
 *           irreversible: true,
 *         },
 *         payload: args, // os args originais ficam guardados pra debug se quiser
 *       });
 *       return { ok: true, data: approval };
 *     }
 *
 *     if (!consumeApprovalToken(token, 'delete_content')) {
 *       return { ok: false, error: 'Token de aprovação inválido ou expirado.' };
 *     }
 *
 *     // procede com a deleção
 *     await db.delete(...);
 *     return { ok: true, data: { deleted: true } };
 *   };
 */

import { randomUUID } from 'node:crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000;
const STORE_MAX_ENTRIES = 500;

interface TokenEntry {
  action: string;
  expiresAt: number;
  /** Opcional — guarda os args pra auditoria/log futuro. */
  payload?: unknown;
}

const tokenStore = new Map<string, TokenEntry>();

/**
 * Limpa tokens expirados. Roda no evento de criação pra evitar growth
 * desnecessário (lazy GC).
 */
function gcExpired(): void {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (entry.expiresAt < now) tokenStore.delete(token);
  }
  // Cap absoluto — se passou do limite (raríssimo), drop the oldest entries.
  if (tokenStore.size > STORE_MAX_ENTRIES) {
    const excess = tokenStore.size - STORE_MAX_ENTRIES;
    const iter = tokenStore.keys();
    for (let i = 0; i < excess; i++) {
      const k = iter.next().value;
      if (k) tokenStore.delete(k);
    }
  }
}

export interface ApprovalImpactedItem {
  id: string;
  label: string;
}

export interface ApprovalPreview {
  /** Título curto do modal — ex: "Deletar carrossel?". */
  title: string;
  /** Descrição completa do que vai acontecer. */
  description: string;
  /** Lista opcional de items afetados (ex: ids + nomes dos posts deletados). */
  impactedItems?: ApprovalImpactedItem[];
  /** True se a ação é irreversível (mostra warning vermelho no modal). */
  irreversible?: boolean;
}

/**
 * Payload retornado pra UI quando uma tool exige aprovação. O front detecta
 * `requiresApproval === true`, abre o modal e (se o user confirmar) re-executa
 * a tool com o mesmo args + `approved: true` + o `callbackToken`.
 */
export interface ApprovalRequest {
  requiresApproval: true;
  action: string;
  preview: ApprovalPreview;
  callbackToken: string;
  /** Nome da tool que precisa ser re-chamada com `approved: true`. Opcional —
   * só preencher se o caller souber. O wire-up no kai-simple-chat resolve isso. */
  toolName?: string;
  /** Args originais que devem ser passados de volta na re-call. */
  toolArgs?: Record<string, unknown>;
  /** Quando o token expira (ISO). */
  expiresAt: string;
}

export interface RequireApprovalOptions {
  action: string;
  preview: ApprovalPreview;
  /** Opcional — args originais pra ecoar de volta na re-call (incluindo overrides). */
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  /** Opcional — payload arbitrário pra log/auditoria. */
  payload?: unknown;
}

/**
 * Gera um ApprovalRequest + reserva o token na store. Retorne o objeto direto
 * como `data` da tool — o runner detecta e propaga via stream.
 */
export function requireApproval(opts: RequireApprovalOptions): ApprovalRequest {
  gcExpired();
  const token = `appr_${randomUUID()}`;
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  tokenStore.set(token, {
    action: opts.action,
    expiresAt,
    payload: opts.payload,
  });
  return {
    requiresApproval: true,
    action: opts.action,
    preview: opts.preview,
    callbackToken: token,
    toolName: opts.toolName,
    toolArgs: opts.toolArgs,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

/**
 * Valida e consome o token (single-use). Retorna `true` se o token existe,
 * está dentro do TTL e bate com `expectedAction`. Após consumir, remove do store.
 */
export function consumeApprovalToken(token: string, expectedAction: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const entry = tokenStore.get(token);
  if (!entry) return false;
  tokenStore.delete(token); // consume always (single-use)
  if (entry.expiresAt < Date.now()) return false;
  if (entry.action !== expectedAction) return false;
  return true;
}

/**
 * Type guard — útil em tools/runner pra decidir se o `data` é um ApprovalRequest.
 */
export function isApprovalRequest(value: unknown): value is ApprovalRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { requiresApproval?: unknown }).requiresApproval === true &&
    typeof (value as { callbackToken?: unknown }).callbackToken === 'string' &&
    typeof (value as { action?: unknown }).action === 'string'
  );
}

/**
 * Para testes — não usar em prod. Limpa todos os tokens.
 */
export function _resetApprovalStoreForTests(): void {
  tokenStore.clear();
}

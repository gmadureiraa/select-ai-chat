// Port of supabase/functions/_shared/tokens.ts → Neon
import { getPool, query, queryOne } from '../db.js';

export interface TokenCheckResult {
  hasTokens: boolean;
  balance: number;
  isUnlimited: boolean;
  planType?: string;
  error?: string;
}

export interface TokenDebitResult {
  success: boolean;
  newBalance: number;
  error?: string;
}

export const TOKEN_COSTS = {
  chat_simple: 1,
  chat_long: 3,
  image_generation: 10,
  document_analysis: 5,
  knowledge_processing: 5,
  style_analysis: 5,
  performance_insights: 3,
  youtube_sentiment: 3,
  branding_extraction: 5,
  // Viral apps (Fase F — 2026-05-08)
  carousel: 50,
  reel: 20,
  brief: 10,
  image: 5,
};

/**
 * Viral-specific costs (subset de TOKEN_COSTS pros 3 viral apps).
 * Espelhado em src/hooks/useViralAccess.ts → VIRAL_TOKEN_COSTS.
 */
export const VIRAL_TOKEN_COSTS = {
  carousel: 50,
  reel: 20,
  brief: 10,
  image: 5,
} as const;

export type ViralTokenOp = keyof typeof VIRAL_TOKEN_COSTS;

export async function checkWorkspaceTokens(
  workspaceId: string,
  requiredAmount: number = 1
): Promise<TokenCheckResult> {
  try {
    // Try to find an active subscription with type
    const sub = await queryOne<any>(
      `SELECT sp.type AS plan_type
         FROM workspace_subscriptions ws
         LEFT JOIN subscription_plans sp ON sp.id = ws.plan_id
        WHERE ws.workspace_id = $1 AND ws.status = 'active'
        LIMIT 1`,
      [workspaceId]
    ).catch(() => null);

    const planType = sub?.plan_type;
    if (planType === 'enterprise') {
      return { hasTokens: true, balance: 999_999_999, isUnlimited: true, planType };
    }

    const tokens = await queryOne<any>(
      `SELECT balance FROM workspace_tokens WHERE workspace_id = $1 LIMIT 1`,
      [workspaceId]
    ).catch(() => null);

    const balance = Number(tokens?.balance ?? 0);
    return { hasTokens: balance >= requiredAmount, balance, isUnlimited: false, planType };
  } catch (error) {
    return { hasTokens: false, balance: 0, isUnlimited: false, error: String(error) };
  }
}

export async function debitWorkspaceTokens(
  workspaceId: string,
  userId: string | null,
  amount: number,
  description: string,
  metadata: Record<string, unknown> = {}
): Promise<TokenDebitResult> {
  try {
    const check = await checkWorkspaceTokens(workspaceId, amount);
    if (check.isUnlimited) return { success: true, newBalance: 999_999_999 };
    if (!check.hasTokens) return { success: false, newBalance: check.balance, error: 'Insufficient tokens' };

    // Try the SQL RPC equivalent
    try {
      const rows = await query<any>(
        `SELECT * FROM debit_workspace_tokens($1, $2, $3, $4, $5::jsonb)`,
        [workspaceId, amount, userId, description, JSON.stringify(metadata)]
      );
      const result = rows?.[0];
      if (!result?.success) {
        return { success: false, newBalance: result?.new_balance ?? check.balance, error: result?.error ?? 'debit failed' };
      }
      return { success: true, newBalance: Number(result.new_balance) };
    } catch (rpcErr) {
      // Fallback: do it inline
      await getPool().query(
        `UPDATE workspace_tokens SET balance = balance - $1 WHERE workspace_id = $2`,
        [amount, workspaceId]
      );
      return { success: true, newBalance: check.balance - amount };
    }
  } catch (error) {
    return { success: false, newBalance: 0, error: String(error) };
  }
}

export async function getWorkspaceIdFromUser(userId: string): Promise<string | null> {
  try {
    const row = await queryOne<{ workspace_id: string }>(
      `SELECT workspace_id FROM workspace_members WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return row?.workspace_id ?? null;
  } catch {
    return null;
  }
}

export class InsufficientTokensError extends Error {
  status = 402;
  code = 'TOKENS_EXHAUSTED';
  constructor() {
    super('Tokens insuficientes. Faça upgrade do seu plano para continuar.');
  }
}

// ============================================================================
// Fase F (2026-05-08) — Helpers padronizados pros handlers viral
// ============================================================================
//
// Diferente de checkWorkspaceTokens/debitWorkspaceTokens (que usam balance), os
// helpers abaixo trabalham com `monthly_quota - tokens_used_this_period`, ou
// seja, contagem MENSAL com rollover automático. A função SQL `debit_tokens`
// (migration 0013) já cuida do reset quando period_end < now().

export interface TokenStatus {
  ok: boolean;
  remaining: number;
  /** Quando ok=false, vem o que faltou (= amountNeeded). */
  needed?: number;
  error?: string;
}

/**
 * Verifica se o workspace tem tokens mensais suficientes pra `amountNeeded`.
 * Não consome — só consulta. Use ANTES do prompt building.
 */
export async function checkTokens(
  workspaceId: string,
  amountNeeded: number
): Promise<TokenStatus> {
  try {
    const row = await queryOne<{ result: { remaining: number; quota: number; used: number } }>(
      `SELECT public.check_tokens($1) AS result`,
      [workspaceId]
    );
    const remaining = Number(row?.result?.remaining ?? 0);
    return {
      ok: remaining >= amountNeeded,
      remaining,
      needed: remaining >= amountNeeded ? undefined : amountNeeded,
    };
  } catch (error) {
    return { ok: false, remaining: 0, needed: amountNeeded, error: String(error) };
  }
}

/**
 * Debita `amount` tokens do workspace de forma atômica via SQL function.
 * Use DEPOIS de geração bem-sucedida (não bloqueia se falhar — apenas loga).
 *
 * @returns { ok, remaining } — `ok=false` quando insuficiente ou erro
 */
export async function debitTokens(
  workspaceId: string,
  amount: number,
  reason: string = 'usage'
): Promise<TokenStatus> {
  try {
    const row = await queryOne<{ result: { ok: boolean; remaining: number; balance?: number; error?: string } }>(
      `SELECT public.debit_tokens($1, $2, $3) AS result`,
      [workspaceId, amount, reason]
    );
    const result = row?.result;
    if (!result) {
      return { ok: false, remaining: 0, error: 'no_result' };
    }
    return {
      ok: !!result.ok,
      remaining: Number(result.remaining ?? 0),
      error: result.error,
    };
  } catch (error) {
    return { ok: false, remaining: 0, error: String(error) };
  }
}

/**
 * Wrapper conveniente: lança InsufficientTokensError se não tem saldo.
 * Use no início de handlers críticos (carousel/reel/brief).
 */
export async function ensureTokens(workspaceId: string, amountNeeded: number): Promise<void> {
  const status = await checkTokens(workspaceId, amountNeeded);
  if (!status.ok) {
    throw new InsufficientTokensError();
  }
}

/**
 * Approval Flow — helper pra tools destrutivas/sensíveis do KAI Agent.
 *
 * Padrão: a tool é chamada uma 1ª vez SEM `approved: true`. Ela monta um
 * preview e devolve uma `ApprovalRequest` ao LLM/UI. O front mostra um
 * modal de confirmação. Se o usuário confirma, a UI re-executa a mesma tool
 * com `approved: true` + o mesmo `callbackToken`. O backend valida o token
 * (uso único, expira em 5min) e segue com a ação destrutiva real.
 *
 * STORE: Postgres (`approval_tokens` table, migration 0043). Antes era
 * `Map<string, TokenEntry>` em memória — quebrava em prod multi-instância
 * (lambda A gera token, lambda B recebe a re-call e não tem o Map →
 * "Token inválido" mesmo o user tendo confirmado no modal).
 *
 * Consume é atômico via `UPDATE ... WHERE consumed_at IS NULL RETURNING id`,
 * então duas lambdas concorrentes consumindo o mesmo token vêem apenas uma
 * vitoriosa. Single-use real, garantido pelo Postgres.
 *
 * FAIL-CLOSED: se o DB tá indisponível, requireApproval e consumeApprovalToken
 * lançam exception. Aprovação é gate de segurança — preferimos falhar a
 * autorizar uma deleção sem prova de consentimento.
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
 *       const approval = await requireApproval({
 *         action: 'delete_content',
 *         createdBy: ctx.userId,
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
 *     if (!(await consumeApprovalToken(token, 'delete_content'))) {
 *       return { ok: false, error: 'Token de aprovação inválido ou expirado.' };
 *     }
 *
 *     // procede com a deleção
 *     await db.delete(...);
 *     return { ok: true, data: { deleted: true } };
 *   };
 */

import { query, queryOne } from './db.js';

const TOKEN_TTL_MS = 5 * 60 * 1000;
const TOKEN_PREFIX = 'appr_';

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
  /** Opcional — payload arbitrário pra log/auditoria (vai em `payload` jsonb). */
  payload?: unknown;
  /** UUID do user que disparou o approval. Recomendado — habilita RLS scope
   *  e auditoria "quem pediu pra deletar o quê". */
  createdBy?: string;
  /** UUID do workspace ativo. Opcional — pra auditoria cross-workspace. */
  workspaceId?: string;
  /** Override do TTL (ms). Default: 5min. */
  ttlMs?: number;
}

interface ApprovalTokenRow {
  id: string;
  expires_at: string; // ISO from Postgres
}

/**
 * Converte UUID puro do Postgres pra string token com prefixo (mantém o
 * formato visível ao caller — `appr_<uuid>` ajuda em log/grep e impede
 * confusão com outros UUIDs no payload).
 */
function tokenFromId(id: string): string {
  return `${TOKEN_PREFIX}${id}`;
}

/**
 * Extrai o UUID de um token com prefixo. Retorna null se o formato não bate
 * (ex: token vazio, sem prefixo, ou UUID malformado).
 */
function idFromToken(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const id = token.slice(TOKEN_PREFIX.length);
  // Sanity check: UUID v4-ish — 36 chars com hifens nas posições corretas.
  // Não validamos versão (Postgres aceita qualquer uuid format).
  if (id.length !== 36) return null;
  if (!/^[0-9a-f-]+$/i.test(id)) return null;
  return id;
}

/**
 * Gera um ApprovalRequest + persiste o token na tabela. Retorne o objeto
 * direto como `data` da tool — o runner detecta e propaga via stream.
 *
 * Throws se DATABASE_URL não tá configurado ou se o INSERT falhar. Aprovação
 * é gate de segurança — fail-closed é o comportamento correto.
 */
export async function requireApproval(opts: RequireApprovalOptions): Promise<ApprovalRequest> {
  const ttl = opts.ttlMs ?? TOKEN_TTL_MS;
  const expiresAtMs = Date.now() + ttl;
  const expiresAt = new Date(expiresAtMs).toISOString();

  const row = await queryOne<ApprovalTokenRow>(
    `INSERT INTO public.approval_tokens
       (action, payload, created_by, workspace_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, expires_at`,
    [
      opts.action,
      JSON.stringify(opts.payload ?? {}),
      opts.createdBy ?? null,
      opts.workspaceId ?? null,
      expiresAt,
    ],
  );

  if (!row) {
    // Postgres não devolveu o RETURNING — erro infra (network, deadlock).
    throw new Error('[approval-flow] requireApproval: INSERT não retornou row');
  }

  return {
    requiresApproval: true,
    action: opts.action,
    preview: opts.preview,
    callbackToken: tokenFromId(row.id),
    toolName: opts.toolName,
    toolArgs: opts.toolArgs,
    expiresAt: row.expires_at,
  };
}

/**
 * Valida e consome o token (single-use). Retorna `true` se o token existe,
 * está dentro do TTL, não foi consumido ainda E bate com `expectedAction`.
 *
 * Atomic via `UPDATE ... WHERE consumed_at IS NULL RETURNING id` — duas
 * lambdas concorrentes consumindo o mesmo token: só uma vê a row, a outra
 * vê 0 rows = false. Race-free.
 *
 * Validação `action` é dentro do WHERE — token de `delete_content` chamado
 * como `delete_task` falha o UPDATE (0 rows). Ainda assim, fazemos um DELETE
 * de garantia (best-effort) pra invalidar o token e prevenir replay:
 *
 *   1. UPDATE WHERE id=X AND action=Y AND not consumed AND not expired
 *      → 1 row = success
 *      → 0 rows = pode ser: action mismatch, expirado, já consumido, não existe
 *   2. Se 0 rows mas o id existe E ainda não foi consumido, fazemos best-effort
 *      DELETE pra evitar reuso com action diferente (mitiga injection).
 *
 * Retorna false se token mal-formado, DB indisponível, ou qualquer falha.
 * NUNCA retorna true sem ter consumido a row.
 */
export async function consumeApprovalToken(
  token: string,
  expectedAction: string,
): Promise<boolean> {
  const id = idFromToken(token);
  if (!id) return false;
  if (!expectedAction || typeof expectedAction !== 'string') return false;

  try {
    const updated = await query<{ id: string }>(
      `UPDATE public.approval_tokens
          SET consumed_at = NOW()
        WHERE id = $1
          AND action = $2
          AND expires_at > NOW()
          AND consumed_at IS NULL
        RETURNING id`,
      [id, expectedAction],
    );

    if (updated.length === 1) return true;

    // 0 rows = action mismatch, expirado, já consumido, ou não existe.
    // Tenta invalidar o token mesmo assim (anti-injection — previne attacker
    // que pegou um token e está tentando vários `action` strings até achar).
    // É best-effort: se falhar tudo bem, a expiração natural cobre.
    try {
      await query(
        `UPDATE public.approval_tokens
            SET consumed_at = NOW()
          WHERE id = $1
            AND consumed_at IS NULL`,
        [id],
      );
    } catch (gcErr) {
      // ignore — best effort
      console.warn('[approval-flow] gc on failed consume:', gcErr);
    }

    return false;
  } catch (err) {
    // DB indisponível — fail-closed (não autoriza a ação destrutiva sem
    // ter conseguido consumir). Loga pra diagnóstico.
    console.error('[approval-flow] consumeApprovalToken DB error:', err);
    return false;
  }
}

/**
 * Type guard — útil em tools/runner pra decidir se o `data` é um ApprovalRequest.
 * Permanece sync (não toca DB).
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
 * Para testes — deleta TODOS tokens do DB. Não usar em prod (truncate).
 * Útil em `e2e/_approval-flow-postgres.spec.ts` pra isolar runs.
 */
export async function _resetApprovalStoreForTests(): Promise<void> {
  await query(`TRUNCATE TABLE public.approval_tokens`);
}

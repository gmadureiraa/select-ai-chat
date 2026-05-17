// Smoke test do approval-flow Postgres-backed (migration 0043).
//
// Roda contra Neon dev (mesma instância dos outros _* specs). NÃO usa browser
// — chama as funções direto pelo runtime Node do Playwright.
//
// Validações:
//   1. requireApproval persiste row + devolve token UUID + TTL ~5min
//   2. consume com action correto → true (single-use)
//   3. consume novamente o mesmo token → false (já consumido)
//   4. consume com action ERRADO em token virgem → false + token fica
//      invalidado (anti-bruteforce)
//   5. Token expirado → false
//   6. Token mal-formado → false (sem prefixo, UUID inválido, vazio)
//
// Pré-req: `DATABASE_URL` setado no env. Skipa se ausente.
//
// IMPORTANTE: este spec inserta diretamente na tabela `approval_tokens`. Não
// poluí outras (rows isoladas via createdBy = TEST_USER_UUID). Cleanup ao
// final via `_resetApprovalStoreForTests` (TRUNCATE) — só roda em DBs com
// `process.env.NODE_ENV !== 'production'` checked indireto pela presença
// de DATABASE_URL apontando pra dev (a checagem cabe ao runner).

import { test, expect } from '@playwright/test';
import {
  requireApproval,
  consumeApprovalToken,
  isApprovalRequest,
} from '../api/_lib/approval-flow.ts';
import { query } from '../api/_lib/db.ts';

// Test fixture user — não precisa existir em auth.users porque created_by
// é nullable (FK ON DELETE CASCADE só dispara se a user for deletada).
// Usamos um UUID fixo pra facilitar tracking se algo escapar do cleanup.
const TEST_USER_UUID = '00000000-0000-0000-0000-000000000abc';
const TEST_WORKSPACE_UUID = '00000000-0000-0000-0000-000000000def';

const HAS_DB = !!process.env.DATABASE_URL;

test.describe('approval-flow Postgres (migration 0043)', () => {
  test.skip(!HAS_DB, 'DATABASE_URL not loaded — set in env');

  test.beforeAll(async () => {
    if (!HAS_DB) return;
    // Limpa quaisquer rows de runs anteriores deste user.
    await query(`DELETE FROM public.approval_tokens WHERE created_by IS NOT DISTINCT FROM $1`, [
      TEST_USER_UUID,
    ]);
  });

  test.afterAll(async () => {
    if (!HAS_DB) return;
    await query(`DELETE FROM public.approval_tokens WHERE created_by IS NOT DISTINCT FROM $1`, [
      TEST_USER_UUID,
    ]);
  });

  test('requireApproval persiste row + devolve ApprovalRequest com TTL ~5min', async () => {
    const before = Date.now();
    const approval = await requireApproval({
      action: 'delete_content',
      createdBy: TEST_USER_UUID,
      workspaceId: TEST_WORKSPACE_UUID,
      payload: { planningItemId: 'abc-test' },
      preview: {
        title: 'Test',
        description: 'Test description',
        irreversible: true,
      },
    });
    const after = Date.now();

    expect(isApprovalRequest(approval)).toBe(true);
    expect(approval.requiresApproval).toBe(true);
    expect(approval.action).toBe('delete_content');
    expect(typeof approval.callbackToken).toBe('string');
    expect(approval.callbackToken.startsWith('appr_')).toBe(true);

    // Validate UUID part is well-formed (36 chars).
    const uuid = approval.callbackToken.slice(5);
    expect(uuid).toHaveLength(36);
    expect(/^[0-9a-f-]+$/i.test(uuid)).toBe(true);

    // TTL ~5min — tolerância 30s pra latência do clock/DB.
    const expiresAtMs = new Date(approval.expiresAt).getTime();
    const expectedMin = before + 5 * 60 * 1000 - 30_000;
    const expectedMax = after + 5 * 60 * 1000 + 30_000;
    expect(expiresAtMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAtMs).toBeLessThanOrEqual(expectedMax);

    // Row persistida com payload + workspace_id.
    const rows = await query<{
      action: string;
      payload: any;
      created_by: string | null;
      workspace_id: string | null;
      consumed_at: string | null;
    }>(`SELECT action, payload, created_by, workspace_id, consumed_at
          FROM public.approval_tokens WHERE id = $1`, [uuid]);
    expect(rows.length).toBe(1);
    expect(rows[0].action).toBe('delete_content');
    expect(rows[0].created_by).toBe(TEST_USER_UUID);
    expect(rows[0].workspace_id).toBe(TEST_WORKSPACE_UUID);
    expect(rows[0].consumed_at).toBeNull();
    expect(rows[0].payload).toEqual({ planningItemId: 'abc-test' });
  });

  test('consume com action correto → true (single-use)', async () => {
    const approval = await requireApproval({
      action: 'delete_task',
      createdBy: TEST_USER_UUID,
      preview: { title: 'T', description: 'D' },
    });

    const ok = await consumeApprovalToken(approval.callbackToken, 'delete_task');
    expect(ok).toBe(true);

    // Row deve ter consumed_at populado.
    const uuid = approval.callbackToken.slice(5);
    const rows = await query<{ consumed_at: string | null }>(
      `SELECT consumed_at FROM public.approval_tokens WHERE id = $1`,
      [uuid],
    );
    expect(rows[0].consumed_at).not.toBeNull();
  });

  test('consume novamente o mesmo token → false (já consumido, anti-replay)', async () => {
    const approval = await requireApproval({
      action: 'delete_automation',
      createdBy: TEST_USER_UUID,
      preview: { title: 'T', description: 'D' },
    });

    const ok1 = await consumeApprovalToken(approval.callbackToken, 'delete_automation');
    expect(ok1).toBe(true);

    const ok2 = await consumeApprovalToken(approval.callbackToken, 'delete_automation');
    expect(ok2).toBe(false);
  });

  test('consume com action ERRADO → false + token fica invalidado (anti-bruteforce)', async () => {
    const approval = await requireApproval({
      action: 'delete_reference',
      createdBy: TEST_USER_UUID,
      preview: { title: 'T', description: 'D' },
    });
    const uuid = approval.callbackToken.slice(5);

    // Tenta com action errado primeiro.
    const wrong = await consumeApprovalToken(approval.callbackToken, 'delete_content');
    expect(wrong).toBe(false);

    // Token agora deve estar marcado como consumed mesmo sem ter "succeeded"
    // — anti-bruteforce: attacker não pode tentar várias actions seguidas.
    const rows = await query<{ consumed_at: string | null }>(
      `SELECT consumed_at FROM public.approval_tokens WHERE id = $1`,
      [uuid],
    );
    expect(rows[0].consumed_at).not.toBeNull();

    // Mesmo o action CORRETO depois deve falhar (token já consumido).
    const right = await consumeApprovalToken(approval.callbackToken, 'delete_reference');
    expect(right).toBe(false);
  });

  test('token expirado → false', async () => {
    // TTL negativo simula token criado no passado (já expirado).
    const approval = await requireApproval({
      action: 'delete_planning_item',
      createdBy: TEST_USER_UUID,
      preview: { title: 'T', description: 'D' },
      ttlMs: -10_000, // expired 10s ago
    });

    const ok = await consumeApprovalToken(approval.callbackToken, 'delete_planning_item');
    expect(ok).toBe(false);
  });

  test('tokens mal-formados → false (sem crashar)', async () => {
    // Strings vazias / não-UUID / sem prefixo devem retornar false silenciosamente.
    expect(await consumeApprovalToken('', 'delete_content')).toBe(false);
    expect(await consumeApprovalToken('not-a-token', 'delete_content')).toBe(false);
    expect(await consumeApprovalToken('appr_', 'delete_content')).toBe(false);
    expect(await consumeApprovalToken('appr_not-uuid', 'delete_content')).toBe(false);
    // UUID válido mas sem prefixo → false (prefixo é parte do contrato).
    expect(
      await consumeApprovalToken(
        '00000000-0000-0000-0000-000000000000',
        'delete_content',
      ),
    ).toBe(false);
    // Token com prefixo mas UUID inexistente → false.
    expect(
      await consumeApprovalToken(
        'appr_00000000-0000-0000-0000-000000000999',
        'delete_content',
      ),
    ).toBe(false);
  });

  test('action vazio/inválido → false (defesa em profundidade)', async () => {
    const approval = await requireApproval({
      action: 'delete_task',
      createdBy: TEST_USER_UUID,
      preview: { title: 'T', description: 'D' },
    });

    // @ts-expect-error — testando guard contra runtime garbage
    expect(await consumeApprovalToken(approval.callbackToken, '')).toBe(false);
    // @ts-expect-error — testando guard contra null
    expect(await consumeApprovalToken(approval.callbackToken, null)).toBe(false);

    // Cleanup desse token (não foi consumido nos guards acima).
    await query(
      `UPDATE public.approval_tokens SET consumed_at = NOW() WHERE id = $1`,
      [approval.callbackToken.slice(5)],
    );
  });
});

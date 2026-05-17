# _TRASH-2026-05-16

Arquivos movidos durante a limpeza pós fix wave 2026-05-16.

**Não deletei.** Tudo aqui é candidato a remoção definitiva — revise antes de apagar:

```bash
# Quando confirmar que pode apagar tudo:
rm -rf _TRASH-2026-05-16
git add -A && git commit -m "chore: drop _TRASH-2026-05-16 (reviewed and confirmed)"
```

## O que foi movido e por quê

### `_legacy/` (toda a pasta — 148K, 18+ arquivos)
- `_legacy/performance-tab-apify/KaiPerformanceTab.tsx` — versão antiga Performance v1 (CSV + Apify scrape), substituída por Performance v2 (Metricool) em 2026-05-09. Comentário no Kai.tsx confirma "preservado em legacy caso precise rollback" — após 7+ dias estável, pode ir embora.
- `_legacy/unused-2026-05-09/InboxStats.tsx` — substituído na refatoração de Settings de 2026-05-09.
- `_legacy/viral-replaced-2026-05-08/` — ViralHunterTab + viral-hunter/* (TabIdeas, TabCompetitors, useGoogleNews, etc.) substituídos pelos 3 generators Viral em 2026-05-08. Reels Viral e Radar Viral foram REMOVIDOS de vez em 2026-05-16 (commit `e4575fce`), só Sequência Viral ficou.

**Imports:** zero (`grep -rln "_legacy/" src/ api/` retorna nada além do comentário em Kai.tsx).

### `src/components/kai/viral/SVLauncher.tsx`
- Landing antiga da aba "Sequência Viral". Substituído por `viral-sv-original/MainApp.tsx` em 2026-05-11.
- Comentário em Kai.tsx:67 diz "continua no repo como fallback/documentação" — mas zero imports reais o usam.
- `grep -rn "from.*SVLauncher\|import.*SVLauncher"` em src/ e api/ retorna ZERO matches (só self-references no próprio arquivo + comentário no Kai.tsx).

### Scripts pessoais de inspeção/seed na raiz
- `_inspect_clients.mjs`
- `_seed_clients.mjs`

Scripts one-off de debug/seed. Não referenciados por nenhum `package.json` script, nenhum cron, nenhum import. (Outros scripts `_check_*` e `_smoke_*` que existiam antes já tinham sido removidos em commits anteriores.)

## Decisão de design

Optei por **mover** em vez de **deletar** porque:
1. Gabriel pediu explicitamente "pelo menos mande para uma pasta lixeira pra eu apagar depois"
2. Git histórico já preserva tudo, mas mover mantém o arquivo acessível sem `git log` digging
3. Reduz visualmente o noise no tree/sidebar do editor

## Update 2026-05-17 — Wave Backend Consistency

### `postiz-deprecated/` (10 arquivos movidos pra trash)

Toda a integração Postiz foi arquivada:

- `postiz-analytics.ts`
- `postiz-integrations.ts`
- `postiz-oauth-callback.ts`
- `postiz-oauth-start.ts`
- `postiz-post.ts`
- `postiz-schedule.ts`
- `postiz-summary.ts`
- `postiz-webhook.ts`
- `cron-postiz-poll.ts`
- `postiz.ts` (lib de integração `_lib/integrations/postiz.ts`)

**Por quê:** todos os 9 handlers Postiz estavam **órfãos no manifest** (inacessíveis via HTTP), e o callsite principal (`publish-viral-carousel.ts`) só usava Postiz quando `POSTIZ_API_KEY` estava set — com fallback automático pra Late. A integração nunca foi totalmente ativada em produção.

**Refactor concluído nessa rodada (commit 5594270b):**

1. `publish-viral-carousel.ts` — removido import `postiz-post.js` + flag `usePostiz`. Late é o único provider agora.
2. `src/hooks/useLateConnection.ts` — `apiInvoke('postiz-oauth-start')` → `'late-oauth-start'`; `apiInvoke('postiz-post')` → `'late-post'`.
3. `src/hooks/useClientPlatformStatus.ts` — `apiInvoke('postiz-integrations', { mode: 'verify' })` → `'late-verify-accounts'`.
4. `src/components/settings/WebhookSettings.tsx` — `WEBHOOK_URL` agora aponta pra `/api/late-webhook`.

**Refs residuais (intencional, todos defensivos):**

- `getIntegrationsStatus.ts` lê `metadata.postiz_integration_id` do DB pra compat backward.
- `useSocialCredentials.ts`, `useClientPlatformStatus.ts` aceitam `postiz_account_id` legacy.
- Comentários em hooks/components.

Esses não fazem chamada HTTP — apenas leem dados legados do DB. Quando todos os clientes tiverem migrado credenciais pra `late_account_id`, podem ser removidos.

### Manifest sync (commit 5594270b)

- **Adicionados** ao manifest (9 handlers Late.ai + fetch-late-metrics) — antes inacessíveis via HTTP:
  - `late-analytics`, `late-disconnect-account`, `late-oauth-callback`, `late-oauth-start`, `late-post`, `late-verify-accounts`, `late-webhook`, `late-webhook-reprocess`, `late-webhook-test`, `fetch-late-metrics`.
- **Removidos** (3 entries fantasma — apontavam pra arquivos inexistentes):
  - `automation-webhook` (handler nunca criado),
  - `get-integrations-status` (única chamada era `IntegrationsSettings.tsx` herdada da era Supabase Edge Functions — UI vai precisar migrar pra tool `getIntegrationsStatusTool` do KAI agent ou criar handler dedicado),
  - `viral-library` (unificada com biblioteca normal em 2026-05-08).

**Resultado:** manifest 100% sincronizado com filesystem (zero órfãos, zero phantoms).

## Pendências de refactor maior (não-bloqueantes)

### Hooks com `supabase.from()` direto (bypass de handlers)

11 hooks fazem queries diretas ao Supabase em vez de chamarem handlers backend:

| Hook | Calls |
|---|---|
| `useBrandAssets.ts` | 1 |
| `useClientContext.ts` | 1 |
| `useClientContextGenerator.ts` | 7 |
| `useClients.ts` | 3 |
| `useKAIExecuteAction.ts` | 1 |
| `usePlanningColumns.ts` | 2 |
| `usePlanningComments.ts` | 1 |
| `usePlanningItems.ts` | 1 |
| `useTaskChecklist.ts` | 2 |
| `useTaskComments.ts` | 2 |
| `useTeamTasks.ts` | 1 |
| **TOTAL** | **24 calls** |

Migrar tudo pra usar handlers backend (ou tools do `kai-chat-tools/`) demanda:

1. Criar handlers pra cada operação (alguns já existem como tools, ex. `getBrandAssetsTool`).
2. Atualizar hooks pra usar `apiInvoke()`.
3. Testar paginação, filtros, RLS path-through, etc.

Estimativa: 6-10h focadas.

### Response shape inconsistente

Os 188 handlers usam 3 padrões mistos:

- `{ ok: true, ... }` — 9 ocorrências
- `{ success: true, ... }` — 15 ocorrências
- `{ ...data }` plain (sem flag) — ~119 ocorrências

Padronização sugerida (escolher 1):

- **Manter `{ ok: true | false, data?, error? }`** — alinha com convenção REST + força error path explícito.
- OU manter status code HTTP como source of truth e shapes inline (atual maioria).

Refactor opcional, baixa prioridade.

### Late integration cleanup (futuro, quando migrar pra Metricool full)

Conforme convenção do repo, Metricool é o caminho a longo prazo (já tem 14 handlers em manifest + cron-metricool-poll/snapshot/backfill-posts). Quando o migration target estiver claro:

1. Substituir `apiInvoke('late-*')` por `apiInvoke('metricool-*')` em hooks.
2. Atualizar `connectAccount.ts`, `publishNow.ts`, `scheduleFor.ts` (kai-chat-tools).
3. Atualizar callInternalHandler em `telegram-poll.ts` (calls 2x `late-post`).
4. Atualizar `process-automations.ts` (1 call `late-post`).
5. Mover `late-*` pra `_TRASH-2026-05-17/late-deprecated/`.

Estimativa: 4-6h.

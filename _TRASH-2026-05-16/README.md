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

## Próxima limpeza (não fiz nessa rodada por risco)

Esses são candidatos a próxima onda, mas ainda têm references ativas — precisam refator antes de remover:

- `api/_handlers/late-*.ts` (8 arquivos) — integração Late deprecated. Ainda usada em `WebhookSettings.tsx`, `connectAccount.ts`, `publishNow.ts`, `scheduleFor.ts`, `mcp-reader.ts`, `process-automations.ts`. **Remover só após substituir caminhos por Metricool.**
- `api/_handlers/postiz-*.ts` (8 arquivos) — integração Postiz deprecated. Mesma situação que Late.
- `api/_handlers/cron-postiz-poll.ts` — sem entry no manifest, mas ligado ao Postiz acima.
- `api/_handlers/fetch-late-metrics.ts` — sem entry no manifest, ligado a Late.

Estimativa pra remover esses 18 handlers + refators upstream: 4-6h.

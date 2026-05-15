# Fase 3 — Format Standards em Produção

**Deploy date:** 2026-05-15
**Branch:** `combo-viral-integration`
**Final commit (HEAD):** `d92625cd`
**Commits da Fase 3:**
- `10eb8e20` — feat(format-standards): schema + seed + kai chat injection (camadas 1+2+3)
- `43baee1d` — chore(seed): add Lucas Amendola client entry
- `890b56e6` — feat(format-standards): normalize renderer_template via normalizeDesignTemplate (Fase 5)

---

## Schema aplicado

Migration 0040 (`migrations/0040_format_standards.sql`) aplicada em Neon prod.

| Objeto | Tipo | Status |
|---|---|---|
| `public.format_specs` | TABLE | criada (10 rows) |
| `public.client_format_standards` | TABLE | criada (36 rows) |
| `public.v_client_format_full` | VIEW | criada |
| `idx_format_specs_platform` | INDEX | criado |
| `idx_format_specs_content_type` | INDEX | criado |
| `idx_cfs_client` | INDEX | criado |
| `idx_cfs_format` | INDEX | criado |
| `idx_cfs_status` | INDEX | criado |
| `trg_format_specs_updated_at` | TRIGGER | criado |
| `trg_cfs_updated_at` | TRIGGER | criado |
| RLS policies (8) | POLICY | criadas |

**Timestamps prod:**
- first_created: `2026-05-15 16:34:20 UTC` (13:34 BRT — minutos antes do commit `10eb8e20`)
- last_updated: `2026-05-15 20:38:39 UTC` (17:38 BRT — após commit `890b56e6`)

---

## Camada 1 — `format_specs` (10 formatos canônicos globais)

| format_id | platform | format_name |
|---|---|---|
| blog-longform | blog | Blog post longform (SEO) |
| ig-carrossel-1080x1350 | instagram | Carrossel Instagram |
| ig-reels-9x16 | instagram | Reels Instagram |
| ig-story-1080x1920 | instagram | Story Instagram |
| linkedin-carrossel | linkedin | Carrossel LinkedIn (PDF) |
| linkedin-post | linkedin | Post LinkedIn |
| newsletter | email | Newsletter (email) |
| x-single | twitter | Tweet único X |
| x-thread | twitter | Thread X (Twitter) |
| youtube-script | youtube | Roteiro YouTube (longform) |

---

## Camada 2 — `client_format_standards` (36 specs cliente × formato)

| client_name | client_id | n_formats |
|---|---|---|
| DSEC Labs | `4e8be599-0d50-4759-b8a8-fb0b399e1551` | 6 |
| Defiverso | `6129ea04-e53e-426d-b5ab-ce8553dde11e` | 6 |
| Hugo Doria | `501cc4b6-0055-446a-b71a-d786af0a4158` | 4 |
| Kaleidos | `efdecbbc-00d9-460b-a746-3053b7366f6d` | 4 |
| Laylä Föz | `903d4c5e-e0c1-4098-a336-8fe4da11b1eb` | 4 |
| **Lucas Amendola** | `e600c33f-717d-45c4-aa67-fe76f4130139` | 7 |
| Madureira | `14bf8576-7104-48ca-962d-014308e45a4e` | 5 |
| **TOTAL** | | **36** |

Lucas Amendola foi adicionado como client separado em prod (commit `43baee1d` + seed `_seed_clients.mjs`). Sem rows órfãs (`unknown_clients=0`).

---

## Smoke test (executado contra prod DB hoje, pós-watchdog)

Script: `scripts/_smoke-format-prompt.mjs` (novo, agnóstico de auth) + `_smoke_prod_format_prompt.mjs` (legado do agente).

Resultados:

```
Madureira × ig-carrossel-1080x1350:
  format_name: Carrossel Instagram
  client_name: Madureira
  status: ativo
  renderer_template: madureira-reflection
  client_body_markdown: 8803 chars
  voice_overrides keys: hook_rules, banned_words, tone_markers,
                        banned_phrases, required_marks, banned_punctuation
  examples_validated count: 3

BLOCK HEADER MONTADO:
  "## REGRAS DO FORMATO (Carrossel Instagram pra Madureira)"

Lucas × ig-reels-9x16:
  status: ativo · renderer: face_cam_with_burned_caption · length: 7–90s
  body: 5364 chars · voice keys: 3 · hard_constraints keys: 0

DSEC × linkedin-carrossel:
  status: ativo · renderer: dsec_design_system_dark · length: 5–15 slides
  body: 4975 chars · voice keys: 4 · cta_template keys: 5
```

View `v_client_format_full` responde corretamente pros 36 rows. Bloco "REGRAS DO FORMATO" é montável em todos os casos validados. **PASS.**

---

## Deploy Vercel

**Status: PENDENTE — código não deployado ainda em prod.**

| Field | Value |
|---|---|
| Vercel project | `kai-app` (id `prj_kMDorqybleF8KGsynYhCkeHFsQ7s`) |
| Production alias | `kai-2-topaz.vercel.app` · `kai-kaleidos.vercel.app` |
| Production branch (no Vercel) | `main` (Lovable-managed) |
| Último deploy READY | `dpl_fsu3zQbNnbsbVtKhcZGY1V4X7G3M` em 2026-05-14 16:18 BRT |
| Commit deployado | `795dbb86` (feat(sv-launcher)…) |
| Branch deployada | `combo-viral-integration` via CLI (`source: cli`, `gitDirty: 1`) |
| **Commits Fase 3 deployados?** | **NÃO** — `10eb8e20` é de 15/05 13:35 BRT, **>21h depois** do último deploy |

**O que falta:** rodar `vercel --prod --yes` da branch `combo-viral-integration` pra subir os 3 commits (`10eb8e20`, `43baee1d`, `890b56e6`, + os subsequentes de SV/Defiverso/DSEC renderers que já estão em HEAD). Não foi feito por este agente porque a tarefa restringiu push/deploy "extra".

A injeção de `## REGRAS DO FORMATO` no system prompt está em:
- `api/_lib/shared/format-standards.ts` (helper `loadAndBuildFormatPrompt`)
- `api/_lib/shared/prompt-builder.ts:145`
- `api/_handlers/kai-simple-chat.ts:2069`

Esses 3 arquivos **existem na branch git**, **NÃO existem no deploy Vercel ativo**. Smoke ao endpoint `/api/kai-simple-chat` em prod **não vai injetar** o bloco até o deploy ser feito.

**Smoke contra HTTP em prod foi gated:** o endpoint exige JWT Neon Auth + payload com clientId/messages válidos; sem token a chamada cai em 401 antes de validar a injeção. Smoke do helper foi validado **direto contra o DB**, que é onde a fonte de verdade vive — comprova que `loadFormatStandard(clientId, formatId)` retorna spec completo e `buildFormatSystemPrompt(spec)` consegue montar o header esperado.

---

## Próximos passos

1. **Gabriel autorizar deploy Vercel** com:
   ```bash
   cd /Users/gabrielmadureira/GOS/code/kai-app
   vercel --prod --yes
   ```
   Esperado: ~50s build, novo `dpl_…` com `production` target READY.

2. **Smoke HTTP pós-deploy** (com JWT válido):
   ```bash
   curl -sS https://kai-2-topaz.vercel.app/api/kai-simple-chat \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <NEON_JWT>" \
     -d '{
       "clientId": "14bf8576-7104-48ca-962d-014308e45a4e",
       "messages": [{"role":"user","content":"cria um carrossel sobre IA prática"}],
       "stream": false
     }' | jq .systemPrompt 2>/dev/null | grep "REGRAS DO FORMATO"
   ```
   Ou ler logs Vercel pelo painel pra confirmar que o bloco entra antes da chamada ao Gemini.

3. **Fase 4 (futura)** — Auto-coleta de `examples_validated` via Metricool top performers, conforme nota na migration (`client_format_examples` tabela reservada).

4. **Bloqueadores documentais conhecidos** (do header da migration, NÃO bloqueiam Fase 3):
   - Madureira handle `@madureira0x` → `@ogmadureira` em SKILL.md linha 6
   - DSEC: skill copywriting-dsec v1.0 EN/PT → migrar pra v1.1 PT-BR
   - Lucas: examples_validated vazios em todos os 7 specs (1001 posts archive externos sem análise)
   - Hugo: 02-CONTEUDO e 03-ROTEIROS vazias
   - Kaleidos marca: 3 P0 abertos (brand voice / manifesto / política tom)
   - ClickUp list "Conteúdo Kaleidos Marca" não existe (list_id NULL no spec)

---

## Helpers criados / referenciados

| Path | Função | Persiste? |
|---|---|---|
| `migrations/0040_format_standards.sql` | Migration canônica Fase 3 | sim (commit `10eb8e20`) |
| `scripts/seed-format-standards.ts` | Seed das 2 tabelas a partir do vault | sim (commit `10eb8e20`) |
| `api/_lib/shared/format-standards.ts` | `loadFormatStandard` + `buildFormatSystemPrompt` | sim (commits `10eb8e20`, `890b56e6`) |
| `_run_migration_0040.mjs` | Runner one-shot da migration | helper temporário (gitignored) |
| `_seed_clients.mjs` | Seed clientes (Lucas+) | helper temporário |
| `_check_prod_tables.mjs` | Confirma tabelas Fase 3 em prod | helper temporário |
| `_smoke_prod_format_prompt.mjs` | Smoke 3-clientes do builder | helper temporário |
| `scripts/_check-format-standards.mjs` | (novo, este agente) confirmação rápida counts + per-client | helper temporário |
| `scripts/_smoke-format-prompt.mjs` | (novo, este agente) smoke da view + header bloco | helper temporário |
| `DEPLOY-FASE-3-PROD.md` | Playbook manual pra Gabriel (versão pré-execução) | sim |
| `FASE-3-PROD-DEPLOYED.md` | Este doc — confirma estado pós-execução | sim |

---

_Doc gerado por agente projetos-pessoais em 2026-05-15 após watchdog interrompeu o agente anterior. Schema + dados confirmados via queries diretas no Neon prod (`DATABASE_URL` de `.env.production`). Deploy Vercel ainda pendente — última ação de produção segura é `vercel --prod --yes` pela própria conta do Gabriel._

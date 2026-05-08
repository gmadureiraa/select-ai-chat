# Radar Seed — Fontes RSS + UI Admin + CRON_SECRET

> Branch: `combo-viral-integration` (NÃO commitada)
> Data: 2026-05-07
> Agente: RADAR-SEED

## Resumo

- 15 fontes RSS globais inseridas em `viral_tracked_sources` (cripto, marketing, IA, tech).
- Policy de escrita admin-only criada via `super_admins`.
- UI `RadarSourcesManager` criada e plugada em `/kaleidos?tab=radar-sources-admin`.
- Item de menu "Fontes Radar" no sidebar, gated por `isSuperAdmin`.
- `CRON_SECRET` gerado e setado nos 3 ambientes Vercel (Production, Preview, Development).
- Build passa: `bun run build` — `built in 6.34s`.

## Parte 1 — Migration 0004 aplicada

Arquivo: `migrations/0004_seed_rss_sources.sql`

Aplicada com sucesso:
```
$ /opt/homebrew/opt/libpq/bin/psql "$NEON_URL" -f migrations/0004_seed_rss_sources.sql
INSERT 0 15
DROP POLICY
CREATE POLICY
```

15 fontes inseridas (todas globais, `workspace_id`/`client_id` NULL, ativas):

| Categoria | Fontes |
|-----------|--------|
| crypto    | CoinDesk, CoinTelegraph, Decrypt, The Defiant, The Block, Bitcoin.com, Bankless |
| marketing | Marketing Brew, Marketing Dive, Content Marketing Institute, HubSpot Marketing |
| ai        | VentureBeat AI |
| tech      | The Verge, TechCrunch, Ars Technica |

Policy adicionada:
```sql
CREATE POLICY "viral_tracked_sources admin write"
  ON public.viral_tracked_sources FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.super_admins WHERE user_id = auth.uid()));
```

Idempotente: usa `WHERE NOT EXISTS` no INSERT (não há UNIQUE em `source_url`) e `DROP POLICY IF EXISTS` antes do CREATE.

## Parte 2 — CRON_SECRET configurado

Gerado um secret de 64 chars hex (`openssl rand -hex 32`) e setado nos 3 ambientes do projeto Vercel `kai-2`:

```
$ vercel env ls | grep -i cron
CRON_SECRET    Encrypted    Preview        ago
CRON_SECRET    Encrypted    Development    ago
CRON_SECRET    Encrypted    Production     ago
```

Note: o valor nunca é exposto em logs/docs. O CLI confirmou apenas "Added Environment Variable CRON_SECRET to Project kai-2".

### Próximo passo: redeploy + primeiro scrape

A Vercel só aplica novas env vars em deploys posteriores. Para popular `viral_news_articles` com o primeiro batch de artigos:

1. **Trigar redeploy de production** (necessário pra o handler ler o novo `CRON_SECRET`):
   ```bash
   cd /Users/gabrielmadureira/GOS/code/kai-app-combo
   vercel deploy --prod
   ```
   Ou simplesmente fazer um push em `main` (assumindo branch atual `combo-viral-integration` não está deployada — ainda não comitada).

2. **Pegar o secret via Vercel dashboard ou env pull**:
   ```bash
   vercel env pull .env.cron --environment=production
   grep CRON_SECRET .env.cron
   ```

3. **Triggar manualmente o cron de news** (popula `viral_news_articles`):
   ```bash
   CRON_SECRET=<valor>
   curl -X POST "https://kai-2-topaz.vercel.app/api/cron-scrape-news" \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

   Resposta esperada: JSON com `{ ok: true, results: [{ source_name, inserted, status }, ...] }`.

4. **(Opcional)** Trigar `cron-generate-daily-brief` depois pra gerar o primeiro brief consolidado por client:
   ```bash
   curl -X POST "https://kai-2-topaz.vercel.app/api/cron-generate-daily-brief" \
     -H "Authorization: Bearer ${CRON_SECRET}"
   ```

   `cron-scrape-instagram` e `cron-scrape-tiktok` precisam de `RADAR_IG_CRON_ENABLED=1` / `RADAR_TIKTOK_CRON_ENABLED=1` setados (custo Apify) e fontes do tipo `instagram`/`tiktok` cadastradas — não há nenhuma ainda. Pra IG, cada fonte precisa de `client_id` (a tabela `instagram_posts` é per-client).

## Parte 3 — UI de admin

Criados:
- `src/hooks/useSuperAdmin.ts` — hook compartilhado, RPC `is_super_admin` com fallback de query direta na tabela `super_admins`. Cache 5min.
- `src/components/admin/RadarSourcesManager.tsx` — gerenciador completo de fontes.

Features do `RadarSourcesManager`:
- Lista todas `viral_tracked_sources` ordenadas por tipo + nome.
- 4 cards de stats no topo: Total, Ativas, RSS, Sociais.
- Filtros: busca textual (nome/URL/categoria/nicho), por `source_type`, por `category`, status (ativas/inativas/todas).
- Tabela com badges coloridos por tipo (RSS azul / IG rosa / TikTok cinza / YouTube vermelho / X azul claro / newsletter âmbar).
- `last_scraped_at` formatado em PT-BR via `formatDistanceToNow`.
- Toggle inline `is_active` (Switch shadcn) com mutation.
- Delete com `AlertDialog` de confirmação (sem confirm() do navegador).
- "Nova fonte" abre Dialog com tipo + URL + nome + categoria + nicho.
- Botão Atualizar (refetch) com spinner.

### Plug em Kai.tsx

- Lazy import do `RadarSourcesManager`.
- Hook `useSuperAdmin` consumido na página.
- Tab nova `radar-sources-admin` adicionada em `toolTabs` e no switch de render.
- Route guard: redireciona pra `planning` se não-super_admin tentar acessar via URL.
- Render gated: mostra `ClientRequiredEmpty` com mensagem "Acesso restrito" se entrar sem ser super_admin.

### Plug em KaiSidebar.tsx

- Hook `useSuperAdmin` consumido.
- Novo grupo "Admin" no fim do `<nav>` (depois de "Perfis"), só renderiza se `isSuperAdmin`.
- Item "Fontes Radar" com ícone `<Radar />`, navega pra tab `radar-sources-admin`.

Acesso: `https://kai-2-topaz.vercel.app/kaleidos?tab=radar-sources-admin` (visível só pra users na tabela `super_admins`).

## Parte 4 — Endpoint helper

**Não foi necessário.** A UI escreve direto via `supabase.from("viral_tracked_sources")`. A nova policy `viral_tracked_sources admin write` autoriza FOR ALL pra users no `super_admins` table — RLS resolve no banco.

`viral_tracked_sources` ainda não está nos types regenerados do Supabase (`src/integrations/supabase/types.ts` não foi atualizado pós-migration 0003). O helper `sourcesTable()` no componente faz `(supabase as any).from(...)` como escape hatch — é o mesmo padrão usado em outras tabelas pendentes de codegen.

## Build status

```
$ bun run build
✓ 5000+ modules transformed.
✓ built in 6.34s
```

Novo chunk: `dist/assets/RadarSourcesManager-BnrZbR4O.js  11.09 kB │ gzip: 3.42 kB`.

## Arquivos criados

- `migrations/0004_seed_rss_sources.sql` — seed + policy
- `src/hooks/useSuperAdmin.ts` — hook gating
- `src/components/admin/RadarSourcesManager.tsx` — UI
- `RADAR-SEED-DONE.md` — este doc

## Arquivos modificados

- `src/pages/Kai.tsx` — lazy import + tab `radar-sources-admin` + route guard `isSuperAdmin`
- `src/components/kai/KaiSidebar.tsx` — grupo "Admin" + item "Fontes Radar"

## Bloqueios / TODOs

- **Redeploy pendente**: o `CRON_SECRET` em production precisa de redeploy pra ser injetado no handler. User precisa rodar `vercel deploy --prod` ou push em main.
- **Primeiro scrape manual**: depois do redeploy, rodar curl no `/api/cron-scrape-news` com o bearer token pra popular `viral_news_articles`.
- **Codegen Supabase**: `viral_tracked_sources`, `viral_news_articles`, `viral_tiktok_posts` não estão em `types.ts`. Gerar com `npx supabase gen types typescript --project-id <id>` (ou equivalente Neon) quando conveniente.
- **Fontes IG/TikTok/YouTube**: nenhuma cadastrada ainda. Pra IG, lembrar que precisa `client_id` (per-client). Adicionar via UI quando houver demanda.

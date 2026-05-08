# SETUP.md — KAI 2.0

Setup completo do zero pra desenvolvedor. Passo a passo, ~20 minutos pra sair do `git clone` ao primeiro login.

> Pré-requisitos:
> - macOS, Linux ou WSL
> - Bun ≥ 1.0 (`curl -fsSL https://bun.sh/install | bash`)
> - Node ≥ 20 (algumas tools auxiliares)
> - `psql` (Postgres client) — `brew install libpq` no macOS
> - Vercel CLI — `bun install -g vercel`
> - Acesso ao GitHub repo `gmadureiraa/kai-app`
> - Acesso ao Vercel Project `kai-2`
> - Acesso ao Neon project (Gabriel adiciona)

---

## 1. Clone

```bash
git clone git@github.com:gmadureiraa/kai-app.git
cd kai-app
git checkout combo-viral-integration   # branch atual da migração Neon
```

---

## 2. Instalar dependências

```bash
bun install
```

Esperado: ~590 packages, sem warnings críticos. Demora ~30s na primeira vez.

> **Importante:** o repo tem `bun.lock` e `bun.lockb` (legado) + `package-lock.json` (legado Lovable). Use sempre **Bun** pra manter o `bun.lock` autoritativo.

---

## 3. Login na Vercel + link do projeto

```bash
vercel login
vercel link
# selecionar team: gfmadureiraa-3391s-projects
# selecionar project: kai-2
```

Isso cria `.vercel/project.json` (gitignored).

---

## 4. Env vars

### 4.1. `.env` (commitado, valores não-secretos)

Já vem no repo, contém URLs do Neon Data API + Auth + JWKS. Conferir que existe e tem:

```bash
DATABASE_URL="postgresql://neondb_owner:***@ep-…-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
VITE_SUPABASE_URL="https://ep-….apirest.sa-east-1.aws.neon.tech/neondb"
VITE_SUPABASE_PUBLISHABLE_KEY=""
VITE_NEON_AUTH_URL="https://ep-….neonauth.sa-east-1.aws.neon.tech/neondb/auth"
VITE_NEON_JWKS_URL="https://ep-….neonauth.sa-east-1.aws.neon.tech/neondb/auth/.well-known/jwks.json"
VITE_SUPABASE_PROJECT_ID="kai-neon"
```

Se faltar, copiar de `.env.example` (a criar) ou pedir os valores ao Gabriel.

### 4.2. `.env.local` (gitignored, secrets)

Pull dos secrets de development do Vercel:

```bash
vercel env pull .env.local --environment=development
```

Isso traz `BLOB_READ_WRITE_TOKEN`, `VERCEL_OIDC_TOKEN`, e qualquer chave de API que esteja setada no env de development.

### 4.3. Mínimo viável pra subir

Pra app subir + login funcionar, basta:

| Var | Onde |
|---|---|
| `DATABASE_URL` | `.env` |
| `VITE_SUPABASE_URL` | `.env` |
| `VITE_NEON_AUTH_URL` | `.env` |
| `VITE_NEON_JWKS_URL` | `.env` |
| `NEON_JWKS_URL` (mesmo valor de VITE_NEON_JWKS_URL, sem prefixo) | `.env.local` |
| `BLOB_READ_WRITE_TOKEN` | `.env.local` |
| `GEMINI_API_KEY` | `.env.local` (gerar em https://aistudio.google.com/apikey) |

Lista completa em [`ENV-VARS.md`](./ENV-VARS.md).

---

## 5. Aplicar migrations no Neon

As migrations `0002`, `0003`, `0004` precisam estar aplicadas pra todas as features funcionarem.

```bash
# Conferir conexão
psql "$DATABASE_URL" -c "SELECT 1;"

# Aplicar todas em ordem (idempotentes — `IF NOT EXISTS` em todo lugar)
psql "$DATABASE_URL" -f migrations/0002_library_global.sql
psql "$DATABASE_URL" -f migrations/0003_radar_full.sql
psql "$DATABASE_URL" -f migrations/0004_seed_rss_sources.sql

# Verificar que rodou
psql "$DATABASE_URL" -c "\dt public.viral_*"
# Deve listar: viral_carousels, viral_news_articles, viral_radar_briefs,
# viral_reels, viral_search_cache, viral_tiktok_posts, viral_tracked_sources
```

> A migração principal Supabase → Neon (88 tabelas + 291 RLS policies + extensions) **já foi aplicada** em 2026-05-07 (ver [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md)). Você não precisa rodar de novo. Só os 3 arquivos acima são incrementais pós-migração.

---

## 6. Criar primeiro usuário

A app usa Neon Auth. O primeiro signup cria o user no Neon Auth + a row em `auth.users` (sincronizada).

### Opção A — via UI (recomendado)

```bash
bun run dev   # ou vercel dev
# abrir http://localhost:5173/signup
# criar conta com email + senha
```

### Opção B — via API curl

```bash
curl -X POST "$VITE_NEON_AUTH_URL/sign-up/email" \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@example.com","password":"senhaForte123","name":"Você"}'
```

Resposta: `{ user: { id, email, ... }, session: { token, ... } }`.

### 6.1 Criar workspace

Após login a app vai redirecionar pra `/no-workspace` se você não estiver em nenhum. Hoje o **flow oficial de criação de workspace** é via convite (RPC `add_workspace_member_or_invite`). Pra dev local, criar diretamente via SQL:

```sql
-- exemplo: criar workspace "kaleidos" e adicionar você como owner
INSERT INTO workspaces (id, slug, name) VALUES (gen_random_uuid(), 'kaleidos', 'Kaleidos');

INSERT INTO workspace_members (workspace_id, user_id, role)
VALUES (
  (SELECT id FROM workspaces WHERE slug = 'kaleidos'),
  (SELECT id FROM auth.users WHERE email = 'voce@example.com'),
  'owner'
);
```

### 6.2 Promover a super_admin (acesso à UI de admin)

```sql
INSERT INTO super_admins (user_id) VALUES (
  (SELECT id FROM auth.users WHERE email = 'voce@example.com')
);
```

Isso libera o item "Fontes Radar" e outras tabs gated por `useSuperAdmin()`.

---

## 7. Subir o dev server

### Opção A — só front (rápido)

```bash
bun run dev
# vite dev server em http://localhost:5173
```

Limitação: chamadas a `/api/*` falham (não há server). Bom pra trabalho de UI puro.

### Opção B — front + Vercel Functions juntos (recomendado)

```bash
vercel dev
# normalmente em http://localhost:3000
```

Isso emula o Vercel Functions runtime localmente. Todas as rotas `/api/*` funcionam.

### Build de produção local

```bash
bun run build
bun run preview   # serve dist/ em http://localhost:4173
```

---

## 8. Verificação

Smoke test rápido depois de subir:

1. Acessar `/login` → criar conta ou entrar.
2. Conferir redirect pra `/kaleidos` (workspace default).
3. Sidebar carrega + tabs aparecem.
4. Console do browser sem erros 4xx/5xx críticos.
5. Aba "Planejamento" — deve carregar Kanban (mesmo vazio).
6. Aba "Biblioteca" — deve responder.
7. Em DevTools → Network: requests pra Neon Data API retornam 200 com `Authorization: Bearer eyJ…`.
8. (Opcional) `curl -X POST http://localhost:3000/api/extract-pdf -H "Authorization: Bearer <jwt>" -d '{...}'` — deve responder 200 ou 4xx (não 500).

---

## 9. Troubleshooting

### "JWT missing sub claim" / "Invalid or expired token"
- `VITE_NEON_AUTH_URL` ou `VITE_NEON_JWKS_URL` errado.
- Token expirou — refazer login.
- `NEON_JWKS_URL` (server) não está setado no `.env.local`.

### "DATABASE_URL not configured"
- `.env` não foi lido. Tentar `vercel env pull` de novo.
- `vercel dev` lê `.env` + `.env.local` automaticamente. Se rodando script standalone, fazer `source .env`.

### "BLOB_READ_WRITE_TOKEN not configured"
- Vercel Blob não está habilitado pro projeto. Ir em Vercel → Project `kai-2` → Storage → criar Blob store.
- Ou roda local sem upload — features de imagem vão falhar com 503.

### Build falha "Cannot find module './_handlers/...'"
- Esqueceu o `.js` no import. Imports relativos no `api/` precisam terminar em `.js`.

### Login OK mas todas queries retornam vazio
- RLS bloqueando. Verificar que `auth.users` tem a sua row sincronizada com a session do Neon Auth (`SELECT id, email FROM auth.users WHERE email = 'voce@example.com'`).
- Verificar policies: `\d+ public.<table>` no psql mostra as policies ativas.

### "Failed to load handler 'X'"
- Slug não está em `api/handler-manifest.ts`. Adicionar entrada.
- Ou typo no path do import.

### Vite warning "chunk maior que 500kB"
- Pré-existente. Não bloqueia. Code splitting é TODO conhecido.

---

## 10. Próximos passos

Depois do setup:

- Ler [`ARCHITECTURE.md`](./ARCHITECTURE.md) pra entender os fluxos.
- Ler [`CONTRIBUTING.md`](./CONTRIBUTING.md) pras convenções.
- Conferir [`STUBS-MIGRATED-FINAL.md`](./STUBS-MIGRATED-FINAL.md) pra ver quais features dependem de OAuth/credenciais externas.
- Setar OAuth providers (LinkedIn, Twitter, Late) se for tocar nas features de publishing.
- Setar `CRON_SECRET` + redeploy se for testar crons.

---

## 11. Scripts úteis

```bash
# Type-check sem build
bunx tsc --noEmit -p tsconfig.app.json

# Lint
bun run lint

# Listar env vars do Vercel (production)
vercel env ls production

# Adicionar env var (interativo)
vercel env add NOVA_VAR development

# Logs do deploy mais recente
vercel logs

# Deploy de preview
vercel deploy

# Deploy de prod
vercel deploy --prod

# Pull env de production pro local
vercel env pull .env.production --environment=production

# Conectar ao Neon via psql (com `.env` carregado)
psql "$DATABASE_URL"

# Listar tabelas
psql "$DATABASE_URL" -c "\dt public.*"

# Listar enums
psql "$DATABASE_URL" -c "\dT+ public.*"

# Apply migration manual
psql "$DATABASE_URL" -f migrations/000X_minha.sql
```

---

## 12. Onde pedir ajuda

- Briefing original da migração: [`MIGRATION-NEON-STATUS.md`](./MIGRATION-NEON-STATUS.md)
- Edge functions migradas: [`MIGRATION-EDGE-FUNCTIONS.md`](./MIGRATION-EDGE-FUNCTIONS.md) + `STUBS-MIGRATED-{1..5,FINAL}.md`
- Audit do client pós-migração: [`AUDIT-CLIENT.md`](./AUDIT-CLIENT.md)
- Workspace flow: [`WORKSPACE-FLOW.md`](./WORKSPACE-FLOW.md)
- Radar (cron + seed): [`RADAR-CRON-DONE.md`](./RADAR-CRON-DONE.md), [`RADAR-SEED-DONE.md`](./RADAR-SEED-DONE.md)
- Viral apps (3 tabs): [`VIRAL-PORTED.md`](./VIRAL-PORTED.md)
- Polish do front: [`FRONTEND-POLISH.md`](./FRONTEND-POLISH.md)
- Automações: [`AUTOMATIONS.md`](./AUTOMATIONS.md)
- Organização de clientes: [`GUIA-ORGANIZACAO-CLIENTES.md`](./GUIA-ORGANIZACAO-CLIENTES.md)

Repo gerenciado pelo Lovable em `main` — combinar com Gabriel antes de PRs grandes.

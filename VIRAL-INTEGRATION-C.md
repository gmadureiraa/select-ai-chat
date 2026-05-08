# VIRAL-INTEGRATION-C — Output unificado em planning_items

**Branch:** `combo-viral-integration` (NÃO commitado)
**Data:** 2026-05-08
**Agente:** VIRAL-FASE-C

## Escopo da fase

Unifica o "output" das 3 ferramentas virais (Sequência Viral, Reels Viral, Radar Viral)
num único endpoint que cria planning_items e linka de volta às tabelas de origem
(viral_carousels / viral_reels). Inclui trigger de sincronização reversa: quando o
planning_item é publicado, atualiza a row viral correspondente.

## Arquivos criados / modificados

### Novos
- `migrations/0010_viral_planning_sync.sql` — função + trigger + indexes
- `api/_handlers/save-as-planning-item.ts` — handler unificado (Zod-validated)
- `src/hooks/usePlanningSync.ts` — `useSaveAsPlanningItem` + `useSaveIdeaFromRadar`
- `e2e/08-planning-sync.spec.ts` — smoke tests (auth gate + body validation)

### Modificados
- `api/handler-manifest.ts` — regenerado (115 handlers)
- `src/lib/analytics.ts` — adicionado evento `planning_item_created`

## Schema observado (DB real)

### `planning_items` (já existia)
- `id uuid pk`, `workspace_id`, `client_id`, `column_id` (FK kanban_columns)
- `title`, `content`, `description`, `platform`, `content_type`
- `status` (default `'idea'`) — valores usados: `idea | draft | review | approved | scheduled | published`
- `metadata jsonb` — usado pra `source`, `viral_carousel_id`, `viral_reel_id`, etc.
- `published_at` — sincronizado pelo trigger
- RLS: `is_workspace_member(auth.uid(), workspace_id)`

### `viral_carousels` (já existia)
- `planning_item_id uuid` (FK reverso) — usado pra sync
- `published_at`, `status`

### `viral_reels` (já existia)
- `planning_item_id uuid` (FK reverso)
- **NÃO tem `published_at`** — trigger só atualiza `status` + `updated_at`

## Migration 0010 — sync trigger

```sql
CREATE OR REPLACE FUNCTION public.sync_publish_to_viral()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
    UPDATE public.viral_carousels
    SET status = 'published',
        published_at = COALESCE(NEW.published_at, now())
    WHERE planning_item_id = NEW.id;

    IF NEW.metadata ? 'viral_reel_id' THEN
      UPDATE public.viral_reels
      SET status = 'published',
          updated_at = now()
      WHERE id = (NEW.metadata->>'viral_reel_id')::uuid;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER planning_item_publish_sync
AFTER UPDATE OF status ON public.planning_items
FOR EACH ROW EXECUTE FUNCTION public.sync_publish_to_viral();
```

**Nota importante:** `viral_reels` não tem coluna `published_at`. O trigger
só atualiza `status` + `updated_at` pra esse caso. Se a Fase D/E precisar
de `published_at` em reels, criar nova migration que adiciona a coluna e
atualiza o trigger.

**Status no DB:** aplicado com sucesso.

```
$ psql ... -f migrations/0010_viral_planning_sync.sql
CREATE FUNCTION
DROP TRIGGER  (não existia — esperado)
CREATE TRIGGER
CREATE INDEX
CREATE INDEX
```

## Handler `save-as-planning-item`

### Contrato (Zod)

```ts
{
  client_id: uuid,
  workspace_id: uuid,
  source: 'sv' | 'reels' | 'radar',
  title: string,
  content?: string,
  description?: string,
  content_type?: 'carousel' | 'reel_script' | 'static_image' | 'thread' |
                 'social_post' | 'newsletter' | 'other',
  platform?: string,
  status?: 'idea' | 'draft' | 'review' | 'approved' | 'scheduled' | 'published',
  scheduled_at?: string,
  metadata?: Record<string, unknown>,
  link_to?: {
    viral_carousel_id?: uuid,
    viral_reel_id?: uuid,
  }
}
```

### Comportamento

1. **Validação Zod** → 400 com lista de erros
2. **Defaults**:
   - `content_type` por source: `sv`→`carousel`, `reels`→`reel_script`, `radar`→`other`
   - `status` por source: `radar`→`idea`, demais→`draft`
3. **Coluna kanban**: pega a primeira coluna do workspace (`ORDER BY position ASC LIMIT 1`)
4. **Metadata enrichment**: injeta `source`, `viral_carousel_id`, `viral_reel_id`
5. **FK reverso**: se `link_to` foi passado, atualiza `viral_carousels.planning_item_id`
   ou `viral_reels.planning_item_id` com o ID recém-criado

### Auth

`authedPost()` (CORS + verifyAuth + JSON body parse + 500 fallback). 401 sem token.

## Hook `usePlanningSync`

### `useSaveAsPlanningItem()`
- Hook genérico — recebe `SaveAsPlanningInput` completo
- onSuccess: invalida `['planning-items']`, `['planning-items', workspace_id]`,
  `['planning-items', client_id]`
- Toast: "Conteúdo salvo no planejamento" (sv/reels) ou "Ideia salva no
  planejamento" (radar)
- `trackEvent('planning_item_created', { source, content_type })`

### `useSaveIdeaFromRadar()`
- Wrapper específico do Radar — pré-preenche metadata com
  `{ url, source_type, captured_at }` e força `status='idea'` + `content_type='other'`
- Retorna `{ mutateAsync, isPending, isError, error }`

## E2E test

`e2e/08-planning-sync.spec.ts` — 3 cenários:
1. POST sem auth → 401
2. POST com body inválido + token bogus → 400 ou 401
3. GET → 401 ou 405

## Build

```
$ bun run build
✓ built in 12.14s
```

```
$ bunx tsc --noEmit -p tsconfig.json
(sem erros)
```

## Bloqueios

Nenhum.

## Notas pra próximas fases

- **Frontend agent (FRONTEND-VIRAL)** vai consumir `useSaveAsPlanningItem` /
  `useSaveIdeaFromRadar` nos componentes `viral-{sv,reels,radar}-original`.
  Botão "Salvar no Planejamento" / "Salvar Ideia" em cada superfície.
- **Fase D (embed-client-content)** deve detectar planning_items criados
  via source='sv'|'reels'|'radar' e gerar embeddings se aplicável.
- **Fase F (useViralAccess)** controla se o botão de "salvar" aparece em
  cada superfície baseado no plano do usuário.
- **Reels published_at gap**: viral_reels não tem coluna `published_at`. Se
  precisar rastrear quando o reel foi publicado, criar migration nova.

## Critério "pronto"

- [x] Migration 0010 aplicada
- [x] Handler `save-as-planning-item` funcional (Zod + auth + FK back-link)
- [x] Hook `usePlanningSync` (`useSaveAsPlanningItem` + `useSaveIdeaFromRadar`)
- [x] Manifest regenerado (115 handlers, inclui `save-as-planning-item`)
- [x] 1 E2E test (`e2e/08-planning-sync.spec.ts`)
- [x] `bun run build` passa
- [x] `tsc --noEmit` sem erros
- [x] Documento `VIRAL-INTEGRATION-C.md` (este arquivo)

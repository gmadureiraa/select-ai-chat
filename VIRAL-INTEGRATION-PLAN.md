# Plano de Integração — Viral Apps × KAI Multi-tenant

**Data:** 2026-05-08
**Status:** spec — pronto pra aprovação do Gabriel
**Scope:** Sequência Viral, Reels Viral, Radar Viral integrados ao KAI lendo contexto de cada cliente

---

## 1. Estado atual

### 1.1 O que já funciona
- ✅ 3 viral apps copiados literal preservando estética (`viral-sv-original/`, `viral-reels-original/`, `viral-radar-original/`)
- ✅ Tabelas multi-tenant: `viral_carousels`, `viral_reels`, `viral_radar_briefs` já têm `client_id` + `workspace_id` + `user_id`
- ✅ `client_preferences` (key/value: tone, pillars, persona, do/dont)
- ✅ `client_content_library`, `client_reference_library`, `client_documents`, `client_visual_references`
- ✅ `client_viral_keywords` + `client_viral_competitors` (tabelas existem mas vazias)
- ✅ Tabs viral recebem `{ clientId, client }` por props
- ✅ `planning_items` tem FKs pra workspace + client + column (kanban)
- ✅ Bridge bidirecional Radar → Reels via `?tema=&topic=&briefing=&url=` (Reels já lê)

### 1.2 O que está SOLTO (precisa amarrar)
- ❌ Tabs viral **não leem** `client_preferences` (tone/pillars/persona não pre-popula prompts)
- ❌ Tabs viral **não usam** `client_documents` / `client_reference_library` como contexto IA
- ❌ Bridge SV ← Radar/Reels não está implementado (só Radar → Reels funciona)
- ❌ Outputs SV/Reels não criam `planning_items` automaticamente
- ❌ `client_viral_keywords` / `competitors` vazios — Radar não filtra por cliente
- ❌ Radar é GLOBAL hoje — fontes não são per-client
- ❌ Knowledge feedback loop (conteúdo viral do cliente → embeddings → next prompts) não existe
- ❌ Limites por plano (`max_clients`, `viral_carousel`, `monthly_tokens`) não enforçados

---

## 2. Arquitetura alvo

```
┌─────────────────────────────────────────────────────────────────┐
│  KAI Workspace (Kaleidos)                                        │
│  └── ClientSelector ───── < cliente atual contexto global > ──┐ │
│                                                                  │ │
│  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  Tab Carrossel (Sequência Viral)                         │◄──┤ │
│  │  ├── BriefingPanel — pre-popula com tom/pillars/persona  │   │ │
│  │  ├── ContextDrawer — visual refs + docs + library        │   │ │
│  │  ├── GenerateButton — chama generate-viral-carousel      │   │ │
│  │  │                    com context client + materials     │   │ │
│  │  ├── SaveAction — vira planning_item + viral_carousel    │   │ │
│  │  └── HistorySidebar — filtro client_id                   │   │ │
│  └─────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
│  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  Tab Reels (Reels Viral)                                 │◄──┤ │
│  │  ├── URLInput / Briefing                                 │   │ │
│  │  ├── ClientContextSidebar — voz + nicho + concorrentes   │   │ │
│  │  ├── AnalyzeButton — chama adapt-viral-reel              │   │ │
│  │  ├── SaveAction — vira planning_item + viral_reel        │   │ │
│  │  └── HistorySidebar — filtro client_id                   │   │ │
│  └─────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
│  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  Tab Radar (Radar Viral)                                 │◄──┤ │
│  │  ├── NicheBar — usa client.industry como default         │   │ │
│  │  ├── DailyBrief — viral_radar_briefs do client           │   │ │
│  │  ├── Feed (News/IG/TikTok/X/Threads/LinkedIn)            │   │ │
│  │  │   ├── Filtra por client_viral_keywords                │   │ │
│  │  │   └── Match com client_viral_competitors              │   │ │
│  │  ├── SourcesManager — admin gere fontes per-client       │   │ │
│  │  └── BridgeActions: → Carrossel / → Reel / → Idea / Save │   │ │
│  └─────────────────────────────────────────────────────────┘   │ │
│                                                                  │ │
│  ┌─────────────────────────────────────────────────────────┐   │ │
│  │  Knowledge & Feedback Loop                               │   │ │
│  │  ├── client_content_library — embeddings via pgvector   │   │ │
│  │  ├── Top performers (likes/views) → reuse pattern        │   │ │
│  │  └── Reuse via search-knowledge nos prompts SV/Reels     │   │ │
│  └─────────────────────────────────────────────────────────┘   │ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Fases de implementação

### **Fase A — Context Loading** (4-6h)
**Objetivo:** Os 3 viral tabs leem contexto do cliente automaticamente

#### A.1 Helper hook `useClientContext(clientId)`
```ts
// src/hooks/useClientContext.ts
export function useClientContext(clientId: string | null) {
  return useQuery({
    queryKey: ['client-context', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      // Busca em paralelo
      const [client, prefs, websites, docs, refs, library, competitors, keywords] = await Promise.all([
        supabase.from('clients').select('*').eq('id', clientId).single(),
        supabase.from('client_preferences').select('*').eq('client_id', clientId),
        supabase.from('client_websites').select('*').eq('client_id', clientId),
        supabase.from('client_documents').select('*').eq('client_id', clientId).limit(20),
        supabase.from('client_visual_references').select('*').eq('client_id', clientId).limit(20),
        supabase.from('client_content_library').select('*').eq('client_id', clientId).limit(50).order('created_at', { ascending: false }),
        supabase.from('client_viral_competitors').select('*').eq('client_id', clientId),
        supabase.from('client_viral_keywords').select('*').eq('client_id', clientId),
      ]);

      // Decodifica preferences key/value
      const tone = prefs.data?.find(p => p.preference_type === 'tone')?.preference_value;
      const pillars = prefs.data?.filter(p => p.preference_type === 'content_pillar').map(p => p.preference_value);
      const persona = {
        age: prefs.data?.find(p => p.preference_type === 'persona_age')?.preference_value,
        pain: prefs.data?.find(p => p.preference_type === 'persona_pain')?.preference_value,
        goal: prefs.data?.find(p => p.preference_type === 'persona_goal')?.preference_value,
      };
      const brand = {
        do: prefs.data?.filter(p => p.preference_type === 'brand_do').map(p => p.preference_value),
        dont: prefs.data?.filter(p => p.preference_type === 'brand_dont').map(p => p.preference_value),
      };

      return {
        client: client.data,
        tone,
        pillars,
        persona,
        brand,
        websites: websites.data || [],
        documents: docs.data || [],
        visualReferences: refs.data || [],
        contentLibrary: library.data || [],
        competitors: competitors.data || [],
        keywords: keywords.data || [],
      };
    },
  });
}
```

#### A.2 Pre-fill nos 3 tabs
- **SV BriefingPanel**: tone (Select default), pillars (chips selecionáveis), persona (texto auxiliar visível)
- **Reels Briefing**: nicho default = `client.industry`, persona pre-fill, concorrentes mostrados
- **Radar NicheBar**: nicho default = `client.industry`, fontes filtradas por `client_id` OR `is_global`

#### A.3 Endpoints existentes recebem `clientId` no body
Atualizar handlers `generate-viral-carousel`, `adapt-viral-reel`, `kai-content-agent` pra:
- Aceitar `clientId` no body
- Internamente chamar `useClientContext` (helper SQL `getClientContext(clientId)` server-side)
- Injetar tone/pillars/persona/brand no system prompt do Gemini

---

### **Fase B — Bridge cross-app** (3-4h)
**Objetivo:** Ações cruzadas entre Radar/Reels/SV funcionam via state ou URL

#### B.1 Estado global compartilhado (Zustand store)
```ts
// src/store/viral-context.ts
type ViralContext = {
  pendingBriefing: { source: 'radar' | 'reels' | 'manual'; topic?: string; briefing?: string; url?: string } | null;
  setPendingBriefing: (b) => void;
  consumePendingBriefing: () => typeof pendingBriefing;
};

export const useViralContext = create<ViralContext>(...);
```

#### B.2 Ações cross-app
**No Radar feed cards:**
```tsx
<Button onClick={() => {
  setPendingBriefing({ source: 'radar', topic: article.title, briefing: article.summary });
  navigate('?tab=viral-carrossel');
}}>
  → Gerar Carrossel
</Button>

<Button onClick={() => {
  setPendingBriefing({ source: 'radar', url: post.url, topic: post.caption });
  navigate('?tab=viral-reels-page');
}}>
  → Adaptar Reel
</Button>

<Button onClick={() => saveAsIdea(article)}>
  ⭐ Salvar Ideia
</Button>
```

**No Reels após análise:**
```tsx
<Button onClick={() => {
  setPendingBriefing({ source: 'reels', briefing: result.script, topic: result.title });
  navigate('?tab=viral-carrossel');
}}>
  → Virar Carrossel
</Button>
```

**No SV:**
```tsx
useEffect(() => {
  const pending = consumePendingBriefing();
  if (pending) {
    setBriefing(pending.briefing || pending.topic || '');
  }
}, []);
```

---

### **Fase C — Output unificado em planning_items** (3-4h)
**Objetivo:** Tudo que sai dos viral tabs vira card do kanban (já é parcialmente)

#### C.1 SV → planning_items
Já tem código (botão "Mandar pro Planejamento"). Garantir que:
- Auto-cria `planning_item` quando SAVE de carrossel
- `client_id`, `workspace_id`, `content_type='carousel'`, `status='draft'`, `platform='instagram'`
- `metadata.viral_carousel_id` linkado pro carousel
- Title = first slide heading

#### C.2 Reels → planning_items
- Após análise + save, oferece "Adicionar ao planejamento"
- Cria `planning_item` com `content_type='reel_script'`, `metadata.viral_reel_id`

#### C.3 Radar → planning_items via "Salvar como ideia"
- Cria `planning_item` com `status='idea'`, `content_type='other'`, `metadata.source='radar'`, `metadata.article_url=…`

#### C.4 Webhook bidireccional
Quando user MARK como "publicado" no kanban:
- Atualiza `viral_carousels.status='published'`, `published_at=now()`
- Atualiza `viral_reels.status='published'`
- Trigger SQL pra manter sync

```sql
CREATE TRIGGER planning_item_publish_sync
AFTER UPDATE OF status ON public.planning_items
FOR EACH ROW
WHEN (NEW.status = 'published' AND OLD.status != 'published')
EXECUTE FUNCTION sync_publish_to_viral();
```

---

### **Fase D — Knowledge feedback loop** (4-6h)
**Objetivo:** Conteúdo histórico do cliente alimenta novos prompts

#### D.1 Embeddings em `client_content_library`
```sql
ALTER TABLE public.client_content_library 
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_client_content_embedding 
  ON public.client_content_library 
  USING hnsw (embedding vector_cosine_ops);
```

#### D.2 Backfill handler `embed-client-content`
Lê `client_content_library` rows com `embedding IS NULL`, gera via OpenAI text-embedding-3-small, atualiza.

#### D.3 Helper `findSimilarContent(clientId, query)`
```sql
SELECT id, title, content, metrics, 
       1 - (embedding <=> $query_embedding) AS similarity
FROM public.client_content_library
WHERE client_id = $1 AND embedding IS NOT NULL
ORDER BY embedding <=> $query_embedding
LIMIT 5;
```

#### D.4 Top performers detection
View materializada que destaca conteúdo viral histórico do cliente:
```sql
CREATE MATERIALIZED VIEW client_top_content AS
SELECT 
  client_id,
  id, title, content, content_type,
  (likes + 2*comments + 5*shares) AS engagement_score
FROM client_content_library
WHERE published_at > now() - interval '6 months'
ORDER BY engagement_score DESC;
```

#### D.5 Prompts contextuais
SV `generate-viral-carousel`:
```
"Você é um copywriter pro cliente {client.name}.
Voz: {tone}
Pilares: {pillars}
Persona: {persona}

[REFERÊNCIAS DE SUCESSO DESSE CLIENTE]
{top 3 carrosseis com mais engagement}

[NOVO BRIEFING]
{briefing user}
```

---

### **Fase E — Radar per-client** (4-5h)
**Objetivo:** Radar não é mais 100% global — adapta ao cliente atual

#### E.1 `viral_tracked_sources.client_id` semantics
Hoje `client_id` é nullable em `viral_tracked_sources`. Significados:
- `client_id = NULL` → fonte global (Kaleidos curated)
- `client_id = X` → fonte específica do cliente X

Radar feed: `WHERE client_id = $clientId OR client_id IS NULL`

#### E.2 UI sources manager dual
- **Admin (super_admin)**: fontes globais (já existe `RadarSourcesManager`)
- **Por cliente**: na tab Radar do cliente, botão "Adicionar fonte deste cliente"
  - Modal pra add RSS/IG/TikTok/Twitter/LinkedIn handle
  - `client_id` setado automaticamente

#### E.3 Cron `cron-radar-master` adapta
Hoje roda os 6 scrapers globalmente. Adicionar:
- Loop por workspace
- Pra cada workspace, loop por cliente
- Pra cada cliente, scrape fontes específicas

Atenção: pode estourar limites Apify se muitos clients × muitas fontes. Throttle:
- Free plan: só fontes globais
- Pro plan: até 10 sources por cliente
- Enterprise: ilimitado

#### E.4 `client_viral_keywords` + `client_viral_competitors` populados
- Wizard de onboarding popula isso (já tem briefing form com competitors)
- Radar feed filtra: artigos que tem keyword OU mencionam competitor → top do feed
- "Highlight relevância": badge "🎯 Match keyword: blockchain" no card

#### E.5 `viral_radar_briefs` per-client
Já tem `client_id`. Cron `cron-generate-daily-brief`:
- Pra cada cliente ativo, gera 1 brief
- Brief usa keywords + competitors + nicho do cliente como filtro
- Notifica via push notification: "Brief diário do {client.name} pronto"

---

### **Fase F — Permissões e plano enforcement** (3h)
**Objetivo:** Respeitar role + plan limits

#### F.1 Hooks de permissão
```ts
// src/hooks/useViralAccess.ts
export function useViralAccess() {
  const { subscription } = useSubscription();
  const { role } = useWorkspaceRole();
  const { clients } = useClients();

  const features = subscription?.subscription_plans?.features || {};
  const limits = subscription?.subscription_plans || {};

  return {
    canUseSequencia: features.viral_carousel && (role === 'owner' || role === 'admin' || role === 'member'),
    canUseReels: features.viral_reels && (role === 'owner' || role === 'admin' || role === 'member'),
    canUseRadar: features.viral_radar && (role === 'owner' || role === 'admin' || role === 'member'),
    
    clientsLimit: limits.max_clients ?? -1,
    clientsRemaining: limits.max_clients === -1 ? Infinity : limits.max_clients - clients.length,
    
    monthlyTokens: limits.tokens_monthly ?? 0,
    tokensUsed: subscription?.tokens_used_this_month ?? 0,
    tokensRemaining: (limits.tokens_monthly ?? 0) - (subscription?.tokens_used_this_month ?? 0),
  };
}
```

#### F.2 UI lockouts
- Free plan tenta acessar Reels → mostra `<UpgradePrompt feature="viral_reels" />`
- Member sem assignment a cliente X tenta gerar carrossel → 403 RLS já bloqueia, UI mostra "Você não tem acesso a este cliente"
- Tokens esgotados → bloqueia generation com prompt "Aguarde renovação ou upgrade"

#### F.3 Token consumption tracking
Cada call de IA paga (Gemini, OpenAI, Apify) decrementa `workspace_tokens.balance`:
```ts
// api/_lib/shared/tokens.ts
async function debitTokens(workspaceId, amount, source) {
  await query(`UPDATE workspace_tokens SET balance = balance - $1 WHERE workspace_id = $2`, [amount, workspaceId]);
  await query(`INSERT INTO token_transactions (workspace_id, amount, transaction_type, description) VALUES ($1, -$2, 'usage', $3)`, [workspaceId, amount, source]);
}
```

Cobrança por feature:
- Carrossel SV: -50 tokens (usa Gemini Pro + Imagen)
- Reels análise: -20 tokens (Gemini Flash + Apify)
- Radar brief: -10 tokens (Gemini Flash)

---

### **Fase G — UX polish e drawer contextual** (4h)
**Objetivo:** UI mostra o contexto do cliente sempre visível

#### G.1 ClientContextDrawer (right side)
Em cada tab viral, drawer recolhível à direita:
- **Cliente atual**: avatar + nome + indústria
- **Voz da marca**: tom + 3 pillars
- **Persona resumida**: idade/dor/objetivo
- **Refs visuais**: 4 thumbs
- **Top conteúdo histórico**: 3 cards com engagement
- **Concorrentes**: lista chip

Click drawer → expande pra detalhes completos.

#### G.2 Indicador de cliente no header
Banner top: "Trabalhando em **DEFIVERSO** — Cripto/Web3"  
Trocar cliente via dropdown header.

#### G.3 Auto-save por cliente
SessionStorage key: `kai-viral-{tab}-draft-{clientId}` — troca de cliente NÃO perde rascunho atual (volta ao trocar de volta).

#### G.4 Empty states ricos
Cliente sem conteúdo histórico:
- "Ainda não temos histórico do {client.name}. Comece importando posts existentes (ClickUp/CSV/manual) ou gere o primeiro carrossel."

---

### **Fase H — Analytics & insights** (3h)
**Objetivo:** Mostrar o quanto cada feature está sendo usada

#### H.1 Dashboard "Performance Viral" no KAI Home
Cards novos:
- Carrosseis gerados este mês (por cliente)
- Reels analisados este mês
- Briefs do Radar lidos
- Top performing (publicados via SV/Reels)

#### H.2 Per-client analytics
Em cada client page:
- Tokens consumidos
- Conteúdo criado por mês (gráfico)
- Última atividade

---

## 4. Tabelas / migrations necessárias

| # | Migration | Conteúdo |
|---|---|---|
| **0009** | `client_content_embeddings` | `ALTER client_content_library ADD embedding vector(1536); CREATE INDEX HNSW` |
| **0010** | `viral_planning_sync_trigger` | Trigger pra sync `planning_items.status='published'` ↔ `viral_carousels/reels.status` |
| **0011** | `client_top_content_view` | `MATERIALIZED VIEW client_top_content` + refresh cron diário |
| **0012** | `viral_tracked_sources_per_client` | Garantir RLS deixa user gerenciar fontes do client que ele tem acesso |
| **0013** | `workspace_tokens_initial_balance` | Inicializar tokens pra workspaces existentes baseado no plano |

## 5. Endpoints novos / modificados

| Handler | Status | Mudanças |
|---|---|---|
| `generate-viral-carousel` | modificar | Aceita `clientId`, lê context, injeta no prompt |
| `adapt-viral-reel` | modificar | Idem |
| `cron-generate-daily-brief` | modificar | Loop por client, gera brief per-client |
| `cron-radar-master` | modificar | Adapta scrape per-client se Pro+ |
| `embed-client-content` | criar | Backfill embeddings em `client_content_library` |
| `client-context` | criar | GET retorna context completo (usado por SV/Reels/Radar simulação) |
| `viral-stats` | criar | GET stats per-client (carrosseis/reels/briefs/tokens) |
| `client-add-source` | criar | POST adiciona fonte específica do cliente em `viral_tracked_sources` |

## 6. Componentes UI novos

```
src/components/kai/viral/
  ClientContextDrawer.tsx         # Drawer lateral com contexto cliente
  ClientContextHeader.tsx         # Banner topo "Trabalhando em X"
  CrossAppActions.tsx             # Botões "→ Carrossel/Reel/Idea" reusáveis
  ViralStatsCard.tsx              # Card no HomeDashboard
  TokensRemainingBadge.tsx        # Mostra tokens disponíveis
  UpgradePrompt.tsx               # Modal de upgrade quando feature gated
  
src/store/
  viral-context.ts                # Zustand pra pendingBriefing entre tabs

src/hooks/
  useClientContext.ts             # Aggregator hook
  useViralAccess.ts               # Permissões + plan limits
  useViralStats.ts                # Stats per-client
```

## 7. Roadmap em sprints

| Sprint | Duração | Fases | Entregável |
|---|---|---|---|
| 1 | 1 semana | A + B | Context loading + bridge cross-app — Tabs já leem cliente |
| 2 | 1 semana | C + F | Output unificado planning + permissões plan |
| 3 | 1 semana | D | Knowledge loop com embeddings |
| 4 | 1 semana | E | Radar per-client com fontes próprias |
| 5 | 3 dias | G + H | Polish UX + analytics |

**Total: ~4-5 semanas dev** pra integração completa de qualidade enterprise.

## 8. Critérios de pronto end-to-end

Cenário 1: Criador de conteúdo do Defiverso
1. Login → Workspace Kaleidos → seleciona Defiverso
2. Header mostra "Trabalhando em DEFIVERSO — Cripto/Web3"
3. Abre tab Carrossel → BriefingPanel já tem voz/pillars/persona pre-populados
4. Drawer direito mostra: voz + pillars + 4 refs visuais + top 3 conteúdos
5. Digita briefing → Gerar → carrossel sai com voz do Defiverso
6. Save → vira `planning_item` no kanban automaticamente

Cenário 2: Estratégia
1. Tab Radar → Daily Brief tem articles relevantes pro Defiverso (cripto)
2. News card "BTC ETF Aprovado" → click "→ Carrossel"
3. SV abre com briefing pre-populado: title + summary do news
4. Continua fluxo Cenário 1

Cenário 3: Limite atingido
1. Workspace com plano Free, 5 carrosseis no mês
2. Tenta gerar 6º → modal "Tokens esgotados — Upgrade pra Pro"
3. Click upgrade → BillingTab → checkout

Cenário 4: Feedback loop
1. Workspace tem 50 carrosseis publicados últimos 6 meses
2. Top 5 (por engagement) entram em `client_top_content` view
3. Próximo carrossel: Gemini recebe esses 5 como referência ("seu cliente teve sucesso com esses padrões")
4. Output mais aderente ao histórico vencedor

---

## 9. Riscos identificados

| Risco | Mitigação |
|---|---|
| Custo Apify cresce linearmente com clients × fontes | Throttle por plano + opt-in per-client |
| Latência aumenta com context loading | TanStack Query cache 5min + background refetch |
| Embeddings cost (~$0.02/1M tokens OpenAI) | Re-usar embeddings 6 meses antes de re-gerar |
| RLS complexity com multi-cliente per-user | Usar workspace_member_clients table (já existe) — é authoritative |
| Cliente sem contexto (novo) trava UX | Empty states ricos + sugestão de wizard onboarding |

---

## 10. Decisões pendentes pra Gabriel

1. **Tokens por feature** — preços corretos? (50 carrossel / 20 reel / 10 brief sugeridos)
2. **`subscription_plans` features** — habilitar `viral_carousel/reels/radar` por plano. Free só Radar read-only? Starter+ tudo?
3. **Cron radar per-client** — Pro+ ativa scraping per-client (custo Apify). Free fica em fontes globais?
4. **Embeddings refresh** — quantos meses guardar antes de re-gerar?
5. **Default tone se cliente não tem** — usar voz Kaleidos genérica?

---

**Próximo passo:** Gabriel aprova este plano. Eu disparo agentes paralelos pra Fase A primeiro (mais alto ROI — destrava todos os outros). Cada sprint = 1 PR pra `combo-viral-integration`.

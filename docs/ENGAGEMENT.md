# 💬 Engagement Hub

## Visão Geral

O Engagement Hub permite monitorar e responder a oportunidades de engajamento no Twitter/X. Busca tweets relevantes ao nicho do cliente e sugere respostas com IA.

---

## 🏗️ Componentes

```
src/components/engagement/
├── EngagementHub.tsx      # Hub principal com feed + painel de resposta
├── OpportunityFeed.tsx    # Lista de oportunidades
├── OpportunityCard.tsx    # Card individual
└── ReplyPanel.tsx         # Painel de composição de resposta
```

---

## 📊 Tabela `engagement_opportunities`

```sql
{
  id, client_id,
  tweet_id, tweet_text, tweet_created_at,
  author_username, author_name, author_avatar, author_followers,
  tweet_metrics: jsonb,     -- { likes, retweets, replies, views }
  relevance_score: float,   -- 0.0 a 1.0
  category: text,           -- "industry", "competitor", "audience"
  status: text,             -- "new", "replied", "dismissed"
  reply_text: text,         -- Resposta enviada
  reply_tweet_id: text,     -- ID do tweet de resposta
  replied_at: timestamp,
  metadata: jsonb           -- { keywords_matched, search_query }
}
```

---

## 🔄 Fluxo

### 1. Descoberta (twitter-feed)

```
twitter-feed (Edge Function)
  │
  ├── Busca tweets por keywords do cliente
  │   └── Keywords extraídas de: identity_guide, tags, description
  │
  ├── Classificação por Relevância
  │   ├── author_followers (peso: alto para influenciadores)
  │   ├── engajamento do tweet (likes + retweets + replies)
  │   ├── keyword match score (quantas keywords bateram)
  │   └── recency (tweets mais recentes = maior score)
  │
  ├── Categorização
  │   ├── "industry"    → Tweets sobre o setor do cliente
  │   ├── "competitor"  → Menções a concorrentes
  │   └── "audience"    → Tweets do público-alvo
  │
  └── Salva em engagement_opportunities
      └── relevance_score = weighted_sum(followers, engagement, keyword_match, recency)
```

### Algoritmo de `relevance_score`
```
score = (
  normalize(author_followers, 0, 100000) * 0.25 +
  normalize(tweet_engagement, 0, 1000)   * 0.30 +
  keyword_match_ratio                     * 0.30 +
  recency_decay(tweet_age_hours)         * 0.15
)
```

### 2. Visualização
- Feed de oportunidades ordenado por `relevance_score` DESC
- Filtros: categoria (industry/competitor/audience), status (new/replied/dismissed)
- Busca por tópico/hashtag/@usuario
- Badge visual por categoria

### 3. Resposta

```
Usuário seleciona oportunidade
  → ReplyPanel abre com contexto do tweet
  → Chama twitter-reply para sugestão de IA
  → Usuário edita ou aceita
  → Publica via twitter-post
  → Atualiza status para "replied"
  → Registra reply_tweet_id e replied_at
```

---

## 🤖 Geração de Resposta

Edge function `twitter-reply`:
- Analisa tweet original (tema, sentimento, contexto)
- Carrega identity guide e tom do cliente
- Gera resposta contextual e relevante
- Respeita limite de 280 caracteres
- Evita auto-promoção excessiva
- Tom: contribuição genuína ao diálogo

---

## ⚙️ Configuração de Keywords

Keywords são derivadas automaticamente de:
1. **Identity Guide** do cliente (temas principais)
2. **Tags** do perfil do cliente
3. **Description** do cliente
4. **Conteúdo da biblioteca** (temas recorrentes)

---

## 📊 Rate Limits

| API | Limite | Observação |
|-----|--------|------------|
| Twitter Search | 180 req/15min | App-level rate limit |
| Twitter Post | 200 tweets/24h | Per-user limit |
| Busca de oportunidades | 1x/hora | Cron configurável |

---

*Última atualização: Março 2026*

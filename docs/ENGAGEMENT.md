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
  tweet_metrics: jsonb,     -- likes, retweets, replies
  relevance_score: float,   -- 0-1 relevância para o cliente
  category: text,           -- "industry", "competitor", "audience"
  status: text,             -- "new", "replied", "dismissed"
  reply_text: text,         -- Resposta enviada
  reply_tweet_id: text,     -- ID do tweet de resposta
  replied_at: timestamp
}
```

---

## 🔄 Fluxo

### 1. Descoberta
```
twitter-feed (Edge Function)
  → Busca tweets relevantes ao nicho do cliente
  → Classifica por relevância (author_followers, engajamento, keywords)
  → Salva em engagement_opportunities
```

### 2. Visualização
- Feed de oportunidades ordenado por relevância
- Filtros: categoria, status
- Busca por tópico/hashtag/@usuario

### 3. Resposta
```
Usuário seleciona oportunidade
  → ReplyPanel com sugestão de IA (twitter-reply)
  → Edita ou aceita
  → Publica via twitter-post
  → Atualiza status para "replied"
```

---

## 🤖 Geração de Resposta

Edge function `twitter-reply`:
- Analisa tweet original
- Considera identity guide e tom do cliente
- Gera resposta contextual e relevante
- Respeita limite de 280 caracteres

---

*Última atualização: Março 2025*

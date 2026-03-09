# 📤 Publicação Social
> Última atualização: 09 de Março de 2026

## Visão Geral

O Kaleidos publica conteúdo em redes sociais através da **Late API** (getlate.dev), com fluxo OAuth para conectar contas e edge functions para publicação. Suporta **publicação multi-plataforma** simultânea com tracking individual por rede.

---

## 🔗 Conexão de Contas

### Late API OAuth Flow
```
1. late-oauth-start → Gera URL de autorização Late
2. Usuário autoriza na Late → Redirect para callback
3. late-oauth-callback → Salva tokens em client_social_credentials
4. late-verify-accounts → Verifica contas conectadas
```

### Plataformas Legadas (OAuth Direto)
Para algumas plataformas, há OAuth direto:
- `linkedin-oauth-start` / `linkedin-oauth-callback`
- `twitter-oauth-start` / `twitter-oauth-callback`
- `instagram-oauth-start` / `instagram-oauth-callback`

---

## 📤 Publicação (`late-post`)

### Request
```typescript
interface PostRequest {
  clientId: string;
  platform: 'twitter' | 'linkedin' | 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'threads';
  content: string;
  mediaUrls?: string[];
  mediaItems?: MediaItem[];
  threadItems?: ThreadItem[];    // Threads nativas
  planningItemId?: string;       // Vincula ao card do planning
  scheduledFor?: string;         // ISO date para agendamento
  publishNow?: boolean;
}
```

### Fluxo
1. Valida autenticação e acesso ao cliente
2. Busca credenciais da plataforma em `client_social_credentials`
3. Formata payload para Late API
4. Envia para `https://getlate.dev/api`
5. Atualiza `planning_item` com status de publicação
6. Registra resultado

### Threads Nativas
Twitter e LinkedIn suportam threads:
```typescript
threadItems: [
  { text: "Tweet 1 - Hook", media_urls: ["..."] },
  { text: "Tweet 2 - Desenvolvimento" },
  { text: "Tweet 3 - CTA" }
]
```

### Limites
- `MAX_CONTENT_LENGTH`: 50.000 chars
- `MAX_MEDIA_ITEMS`: 10
- `MAX_THREAD_ITEMS`: 25

---

## 🌐 Publicação Multi-plataforma

### Fluxo Sequencial

Quando o usuário seleciona múltiplas `target_platforms` no dialog de planejamento:

1. O sistema itera por cada plataforma sequencialmente
2. Para cada plataforma, chama `late-post` individualmente
3. O resultado é rastreado no `metadata` do `planning_item`:

```typescript
metadata: {
  target_platforms: ["twitter", "linkedin", "instagram"],
  published_platforms: ["twitter", "linkedin"],  // atualizado a cada sucesso
  late_post_ids: {
    twitter: "late_abc123",
    linkedin: "late_def456"
  },
  published_urls: {
    twitter: "https://x.com/user/status/123",
    linkedin: "https://linkedin.com/posts/..."
  }
}
```

### Deduplicação na Biblioteca

O conteúdo é salvo na `client_content_library` apenas **uma vez**, controlado pelo flag `metadata.added_to_library`. Isso evita duplicatas quando o mesmo conteúdo é publicado em múltiplas redes.

### Publicação via Automações

O `process-automations` também suporta multi-plataforma:
- Lê `automation.platforms[]` (array de plataformas destino)
- Quando `auto_publish = true`, itera por cada plataforma
- Registra tracking individual no metadata do planning_item criado

---

## 📊 Métricas de Publicação

### Coleta
- `fetch-instagram-metrics` — Métricas Instagram via API
- `fetch-late-metrics` — Métricas via Late API
- `fetch-youtube-metrics` — Métricas YouTube
- `collect-daily-metrics` — Cron diário
- `weekly-metrics-update` — Cron semanal

### Dados Coletados
- Likes, comments, shares, saves
- Reach, impressions
- Engagement rate
- Views (vídeo)
- Click-through rate

---

## ✅ Validação de Credenciais

`validate-social-credentials`:
- Verifica se tokens são válidos
- Atualiza `is_valid` e `validation_error` na tabela
- Refresh de tokens expirados (quando suportado)

---

## 🔌 Desconexão

`late-disconnect-account`:
- Revoga tokens na Late API
- Remove credenciais da tabela
- Limpa metadata associada

---

*Última atualização: Março 2026*

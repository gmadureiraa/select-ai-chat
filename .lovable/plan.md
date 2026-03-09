

# Plano: Multi-plataforma + Revisão de Threads/Carrosseis/Reels

## Problemas Identificados

### 1. Publicação em múltiplas plataformas
Atualmente `planning_automations.platform` é `TEXT` (valor único). Para publicar o mesmo conteúdo em múltiplas plataformas, precisamos de uma nova coluna.

### 2. Threads NÃO são enviadas corretamente no auto-publish
**BUG CRÍTICO**: Na linha 1529 do `process-automations`, o auto-publish envia apenas:
```
{ clientId, platform, content: generatedContent, mediaUrls }
```
Mas NÃO envia `threadItems` — mesmo quando `thread_tweets` foram parseados e salvos no metadata. O `late-post` suporta `threadItems`, mas nunca os recebe do auto-publish. Resultado: threads são publicadas como um post único.

### 3. Carrosseis NÃO são enviados corretamente
Mesmo problema: `carousel_slides` são parseados e salvos no metadata, mas o auto-publish não envia `mediaItems` com a estrutura correta de carrossel para o Instagram.

### 4. Reels/Vídeos
O sistema já suporta vídeos via `mediaItems` com type `video`. Não há bug estrutural, mas o auto-publish precisa passar `mediaItems` ao invés de apenas `mediaUrls` quando há vídeo.

---

## Mudanças

### A. Schema: Adicionar `platforms` (array) à tabela
```sql
ALTER TABLE planning_automations ADD COLUMN platforms TEXT[] DEFAULT NULL;
```
Quando `platforms` está preenchido, o sistema publica em todas as plataformas listadas. O campo `platform` existente continua como fallback.

### B. Edge Function `process-automations` — Corrigir auto-publish
1. **Threads**: Quando `metadata.thread_tweets` existe, montar `threadItems` e enviá-los ao `late-post`
2. **Carrosseis**: Quando `metadata.carousel_slides` existe, montar `mediaItems` com ordem correta
3. **Multi-plataforma**: Loop de publicação para cada plataforma em `platforms[]`
4. **Vídeos**: Detectar tipo de mídia e enviar como `mediaItems` com type correto

### C. Hook `usePlanningAutomations` — Suportar `platforms[]`
Adicionar campo `platforms` ao tipo e às operações de create/update.

### D. UI de criação de automação — Multi-select de plataformas
Permitir selecionar múltiplas plataformas ao criar/editar automação.

---

## Detalhes Técnicos

### Fix do auto-publish (mais crítico):

```typescript
// ANTES (bugado):
body: JSON.stringify({
  clientId: automation.client_id,
  platform: derivedPlatform,
  content: generatedContent,
  mediaUrls: mediaUrls,
})

// DEPOIS (correto):
const publishBody: Record<string, unknown> = {
  clientId: automation.client_id,
  platform: targetPlatform,
  content: generatedContent,
  planningItemId: newItem.id,
};

// Threads: enviar threadItems estruturados
if (automation.content_type === 'thread' && updatedMetadata.thread_tweets) {
  publishBody.threadItems = updatedMetadata.thread_tweets.map(t => ({
    text: t.text,
    media_urls: t.media_urls,
  }));
}

// Carrossel/Vídeo: enviar mediaItems com tipo e ordem
if (mediaUrls.length > 0) {
  publishBody.mediaItems = mediaUrls.map((url, i) => ({
    url,
    type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image',
  }));
} 
```

### Multi-plataforma loop:
```typescript
const targetPlatforms = automation.platforms?.length > 0 
  ? automation.platforms 
  : (derivedPlatform ? [derivedPlatform] : []);

for (const targetPlatform of targetPlatforms) {
  // publicar em cada plataforma...
}
```


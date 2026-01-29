

# Plano: Sistema de Automações Completo e Robusto

## Visão Geral dos Problemas Identificados

Após análise detalhada do código, identifiquei os seguintes problemas:

### 1. Tipos de Conteúdo Incompletos no Dialog de Automação
**Problema:** O `AutomationDialog.tsx` usa uma lista estática `CONTENT_TYPES` com apenas 7 tipos:
```typescript
const CONTENT_TYPES = [
  { value: 'social_post', label: 'Post Social' },
  { value: 'carousel', label: 'Carrossel' },
  { value: 'reels', label: 'Reels/Vídeo Curto' },
  { value: 'stories', label: 'Stories' },
  { value: 'thread', label: 'Thread' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'blog', label: 'Blog Post' },
];
```

**Faltam:** Tweet, Artigo no X, Post LinkedIn, Post Instagram, Vídeo Longo, etc.

O sistema já possui uma lista completa em `src/types/contentTypes.ts` com 16 tipos!

### 2. Feedback Incompleto ao Testar Feed
**Problema:** Quando o usuário testa o feed, só vê o título do último item. Deveria ver:
- Lista de campos disponíveis (título, descrição, link, imagens)
- Preview de 2-3 itens para escolher o que usar no prompt
- URLs de imagens extraídas do conteúdo

### 3. Geração de Conteúdo Não Segue Formato
**Problema:** A edge function `process-automations` chama `kai-content-agent` mas:
- Não passa o `format` correto (passa genérico)
- Não informa a plataforma derivada do content_type
- Não extrai imagens do RSS para usar no thread/carrossel

### 4. Thread Sem Imagens do RSS
**Problema:** Para threads/carrosséis, o RSS já traz `allImages` mas isso não é passado para:
- O gerador de conteúdo (para saber quais imagens usar)
- O card de planejamento (para já ter as imagens prontas)

---

## Solução Técnica

### Mudança 1: Usar CONTENT_TYPE_OPTIONS do Sistema

**Arquivo:** `src/components/planning/AutomationDialog.tsx`

Substituir a lista estática `CONTENT_TYPES` pela importação do sistema:

```typescript
import { CONTENT_TYPE_OPTIONS, ContentTypeKey, CONTENT_TO_PLATFORM } from '@/types/contentTypes';
```

E usar no Select com agrupamento por categoria:

```typescript
<SelectContent>
  {/* Twitter/X */}
  <SelectGroup>
    <SelectLabel>Twitter/X</SelectLabel>
    <SelectItem value="tweet">Tweet</SelectItem>
    <SelectItem value="thread">Thread</SelectItem>
    <SelectItem value="x_article">Artigo no X</SelectItem>
  </SelectGroup>
  {/* LinkedIn */}
  <SelectGroup>
    <SelectLabel>LinkedIn</SelectLabel>
    <SelectItem value="linkedin_post">Post LinkedIn</SelectItem>
  </SelectGroup>
  {/* Instagram */}
  <SelectGroup>
    <SelectLabel>Instagram</SelectLabel>
    <SelectItem value="carousel">Carrossel</SelectItem>
    <SelectItem value="stories">Stories</SelectItem>
    <SelectItem value="instagram_post">Post Instagram</SelectItem>
  </SelectGroup>
  {/* E assim por diante... */}
</SelectContent>
```

### Mudança 2: Preview Rico ao Testar Feed

**Arquivo:** `src/components/planning/AutomationDialog.tsx`

Expandir a interface `FeedTestResult` e o componente de resultado:

```typescript
interface FeedTestResult {
  success: boolean;
  feedTitle?: string;
  itemCount?: number;
  latestItems?: Array<{
    title: string;
    description?: string;
    link?: string;
    pubDate?: string;
    imageUrl?: string;
    allImages?: string[];
    content?: string;
  }>;
  availableFields?: string[];
  error?: string;
}
```

UI que mostra:
- **Campos disponíveis:** `{{title}}`, `{{description}}`, `{{link}}`, `{{content}}`, `{{images}}`
- **Preview dos últimos 3 itens** com expandir/colapsar
- **Imagens detectadas** com contador e preview

Texto de ajuda melhorado no prompt template:
```
Use {{title}}, {{description}}, {{link}}, {{content}} e {{images}} para incluir dados do RSS.
Para threads com imagens: as imagens do RSS serão anexadas automaticamente aos tweets.
```

### Mudança 3: Edge Function com Geração de Qualidade

**Arquivo:** `supabase/functions/process-automations/index.ts`

#### 3a. Mapear content_type para format correto

```typescript
const FORMAT_MAP: Record<string, string> = {
  'tweet': 'tweet',
  'thread': 'thread',
  'x_article': 'linkedin', // Similar a post longo
  'linkedin_post': 'linkedin',
  'carousel': 'carousel',
  'stories': 'stories',
  'instagram_post': 'post',
  'static_image': 'post',
  'short_video': 'reels',
  'long_video': 'reels',
  'newsletter': 'newsletter',
  'blog_post': 'newsletter',
  'social_post': 'post', // Legacy
};
```

#### 3b. Chamar kai-content-agent com parâmetros completos

```typescript
const response = await fetch(`${supabaseUrl}/functions/v1/kai-content-agent`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${supabaseKey}`,
  },
  body: JSON.stringify({
    clientId: automation.client_id,
    workspaceId: automation.workspace_id,
    request: prompt,
    format: FORMAT_MAP[automation.content_type] || 'post',
    platform: derivedPlatform,
    stream: false, // Não precisamos de stream para processamento em background
  }),
});
```

#### 3c. Buscar RSS com conteúdo completo e imagens

Quando o trigger for RSS, buscar os dados completos:

```typescript
if (automation.trigger_type === 'rss') {
  const rssResult = await parseRSSFeed(automation.trigger_config.url);
  const latestItem = rssResult[0];
  
  triggerData = {
    ...latestItem,
    allImages: latestItem.allImages || [],
  };
}
```

#### 3d. Incluir imagens do RSS no planning_item

```typescript
const mediaUrls = triggerData?.allImages?.slice(0, 4) || [];

// Para threads, incluir as imagens nos tweets
let initialThreadTweets = null;
if (automation.content_type === 'thread' && mediaUrls.length > 0) {
  // Preparar estrutura inicial de thread com imagens distribuídas
  initialThreadTweets = mediaUrls.slice(0, 4).map((url, i) => ({
    id: `tweet-${i + 1}`,
    text: '',
    media_urls: [url]
  }));
}

const { data: newItem } = await supabase
  .from('planning_items')
  .insert({
    // ... outros campos ...
    media_urls: mediaUrls,
    metadata: {
      automation_id: automation.id,
      source_url: triggerData?.link,
      rss_images: mediaUrls,
      thread_tweets: initialThreadTweets,
    }
  });
```

### Mudança 4: Atualizar kai-content-agent para RSS com Imagens

**Arquivo:** `supabase/functions/kai-content-agent/format-rules.ts`

Adicionar regras para Tweet individual:

```typescript
tweet: `
## REGRAS OBRIGATÓRIAS PARA TWEET

### ESTRUTURA
- Máximo 280 caracteres
- Uma mensagem clara e impactante
- Hashtags no final (máx 2)

### FORMATO DE ENTREGA
\`\`\`
[Texto do tweet - máx 280 chars]

#hashtag1 #hashtag2
\`\`\`

### PROIBIÇÕES ABSOLUTAS
- ❌ Exceder 280 caracteres
- ❌ Mais de 2 hashtags
- ❌ Linguagem corporativa

### TÉCNICAS QUE FUNCIONAM
- ✅ Gancho forte no início
- ✅ Números específicos
- ✅ Call to action no final
`,
```

### Mudança 5: Prompt Template Melhorado

**Arquivo:** `supabase/functions/process-automations/index.ts`

Melhorar a construção do prompt com variáveis extras:

```typescript
let prompt = automation.prompt_template || '';

// Substituir variáveis de template
const variables: Record<string, string> = {
  '{{title}}': triggerData?.title || automation.name,
  '{{description}}': triggerData?.description || '',
  '{{link}}': triggerData?.link || '',
  '{{content}}': triggerData?.content?.substring(0, 3000) || '',
  '{{images}}': (triggerData?.allImages || []).length > 0 
    ? `${triggerData.allImages.length} imagens disponíveis do conteúdo original`
    : 'Sem imagens',
};

for (const [key, value] of Object.entries(variables)) {
  prompt = prompt.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
}

// Adicionar contexto sobre imagens se disponíveis
if (triggerData?.allImages?.length > 0 && automation.content_type === 'thread') {
  prompt += `\n\nIMPORTANTE: O conteúdo original possui ${triggerData.allImages.length} imagens. 
Para a thread, referencie as imagens nos tweets apropriados. 
As imagens serão anexadas automaticamente após a geração do texto.`;
}
```

---

## Fluxo Completo Atualizado

```
1. Usuário cria automação:
   - Seleciona tipo de conteúdo (lista completa: tweet, thread, carousel, etc.)
   - Testa RSS Feed → Vê preview rico com campos disponíveis
   - Escreve prompt usando {{title}}, {{content}}, {{images}}, etc.
   - Ativa auto-publish se desejar

2. Trigger RSS detecta novo item:
   - Extrai título, descrição, conteúdo completo
   - Extrai TODAS as imagens do HTML
   - Guarda tudo no trigger_data

3. Process-automations executa:
   - Cria run em planning_automation_runs
   - Substitui variáveis no prompt template
   - Chama kai-content-agent com format correto
   
4. kai-content-agent gera:
   - Aplica regras específicas do formato
   - Usa contexto do cliente (tom de voz, exemplos)
   - Retorna conteúdo formatado
   
5. Para threads especificamente:
   - Parseia tweets individuais
   - Distribui imagens do RSS entre os tweets
   - Salva thread_tweets no metadata
   
6. Planning item criado:
   - Título, conteúdo gerado
   - media_urls com imagens do RSS
   - metadata.thread_tweets se for thread
   
7. Se auto_publish ativo:
   - Chama late-post com content + media
   - Atualiza status para published

8. Card aparece no Kanban:
   - Com conteúdo pronto
   - Com imagens já anexadas
   - Pronto para revisão ou já publicado
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/planning/AutomationDialog.tsx` | Importar CONTENT_TYPE_OPTIONS, preview rico de RSS, variáveis de template |
| `supabase/functions/process-automations/index.ts` | Format mapping, extração de imagens, substituição de variáveis, thread com imagens |
| `supabase/functions/kai-content-agent/format-rules.ts` | Adicionar regras para Tweet individual |

---

## Resultado Esperado

1. **16 tipos de conteúdo** disponíveis na automação (incluindo Tweet)
2. **Preview rico do RSS** mostrando campos disponíveis e imagens detectadas
3. **Variáveis de template** completas: `{{title}}`, `{{description}}`, `{{link}}`, `{{content}}`, `{{images}}`
4. **Geração de qualidade** com format rules aplicados corretamente
5. **Threads com imagens** do RSS já distribuídas entre os tweets
6. **Carrosséis com imagens** prontas para uso
7. **Conteúdo pronto para publicar** sem necessidade de edição manual


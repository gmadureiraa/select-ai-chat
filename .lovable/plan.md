
# Plano: Sistema de Automações Completamente Funcional e Robusto

## Estado Atual do Sistema

Após análise detalhada, o sistema de automações está **quase completo**, mas precisa de alguns ajustes importantes:

### O que Já Funciona

| Componente | Status | Descrição |
|------------|--------|-----------|
| AutomationDialog | Funcional | 16 tipos de conteúdo, preview rico de RSS |
| process-automations | Funcional | Teste manual, registro de runs, geração de conteúdo |
| kai-content-agent | Funcional | Format rules, contexto do cliente, streaming |
| format-rules.ts | Funcional | Regras para todos os formatos (tweet, thread, etc.) |
| fetch-rss-feed | Funcional | Extração de imagens e conteúdo completo |

### Melhorias Necessárias

| Problema | Impacto | Solução |
|----------|---------|---------|
| Prompt padrão muito simples | Conteúdo genérico | Enriquecer prompt com contexto e exemplos |
| Falta botão "Testar" na listagem | UX ruim | Adicionar ação rápida de teste na lista |
| Falta Firecrawl para scraping | Links genéricos sem imagens | Usar Firecrawl para extrair conteúdo completo |
| Logs detalhados não visíveis | Difícil debugar | Mostrar progresso no dialog de histórico |
| Carousel parsing incompleto | Slides não estruturados | Adicionar parseCarouselFromContent |

---

## Arquitetura do Fluxo

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DE AUTOMAÇÃO                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. GATILHO DETECTADO (RSS/Agenda/Webhook)                              │
│     │                                                                   │
│     ▼                                                                   │
│  2. EXTRAÇÃO DE DADOS                                                   │
│     ├── RSS: parseRSSFeed() → título, descrição, conteúdo, imagens     │
│     ├── Link genérico: Firecrawl → markdown, imagens                   │
│     └── YouTube: Atom feed → videoId, thumbnail, descrição             │
│     │                                                                   │
│     ▼                                                                   │
│  3. SUBSTITUIÇÃO DE VARIÁVEIS                                           │
│     {{title}} → "Como criar newsletters"                                │
│     {{content}} → "O guia completo para..."                             │
│     {{link}} → "https://newsletter.com/..."                             │
│     {{images}} → "4 imagens disponíveis"                                │
│     │                                                                   │
│     ▼                                                                   │
│  4. GERAÇÃO DE CONTEÚDO (kai-content-agent)                             │
│     ├── Format rules aplicadas (thread, tweet, carousel)               │
│     ├── Contexto do cliente (tom de voz, exemplos)                     │
│     ├── Top performers como referência                                 │
│     └── Validação contra checklist                                     │
│     │                                                                   │
│     ▼                                                                   │
│  5. PARSING E ESTRUTURAÇÃO                                              │
│     ├── Thread: parseThreadFromContent → tweets com imagens            │
│     ├── Carousel: parseCarouselFromContent → slides com imagens        │
│     └── Tweet: validação de 280 chars                                  │
│     │                                                                   │
│     ▼                                                                   │
│  6. CRIAÇÃO DO CARD                                                     │
│     ├── planning_items (título, conteúdo, metadata)                    │
│     ├── media_urls (imagens do RSS)                                    │
│     └── metadata.thread_tweets / carousel_slides                       │
│     │                                                                   │
│     ▼                                                                   │
│  7. PUBLICAÇÃO AUTOMÁTICA (se habilitada)                               │
│     └── late-post → Twitter/Instagram/LinkedIn                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças a Implementar

### 1. Enriquecer Prompt Padrão com Contexto

**Arquivo:** `supabase/functions/process-automations/index.ts`

O prompt atual é muito simples. Precisa incluir:
- Tipo de conteúdo específico
- Estrutura esperada
- Contexto sobre imagens
- Tom de voz do cliente

```typescript
function buildEnrichedPrompt(
  template: string, 
  data: RSSItem | null, 
  automation: PlanningAutomation,
  contentType: string
): string {
  // Substituir variáveis básicas
  let prompt = replaceTemplateVariables(template, data, automation.name);
  
  // Se template vazio, criar prompt padrão robusto
  if (!template || template.trim().length < 20) {
    const formatLabel = CONTENT_TYPE_LABELS[contentType] || contentType;
    prompt = `TAREFA: Criar ${formatLabel} profissional

CONTEÚDO BASE:
Título: ${data?.title || automation.name}
${data?.description ? `Resumo: ${data.description.substring(0, 500)}` : ''}
${data?.link ? `Link original: ${data.link}` : ''}

${data?.content ? `CONTEÚDO COMPLETO:\n${data.content.substring(0, 2000)}` : ''}

INSTRUÇÕES:
1. Siga RIGOROSAMENTE as regras do formato ${formatLabel}
2. Mantenha o tom de voz e estilo do cliente
3. Crie conteúdo PRONTO PARA PUBLICAR
4. ${data?.allImages?.length ? `Use as ${data.allImages.length} imagens disponíveis nos pontos apropriados` : 'Não há imagens disponíveis'}`;
  }
  
  // Adicionar contexto sobre imagens para formatos visuais
  if (data?.allImages?.length && ['thread', 'carousel', 'instagram_post'].includes(contentType)) {
    prompt += `\n\n📸 IMAGENS DISPONÍVEIS (${data.allImages.length}): As imagens do conteúdo original serão anexadas automaticamente. Faça referência a elas nos pontos relevantes.`;
  }
  
  return prompt;
}
```

### 2. Adicionar Parsing de Carrossel

**Arquivo:** `supabase/functions/process-automations/index.ts`

```typescript
function parseCarouselFromContent(content: string): Array<{ 
  id: string; 
  text: string; 
  media_urls: string[] 
}> | null {
  const slides: Array<{ id: string; text: string; media_urls: string[] }> = [];
  
  // Pattern 1: "Página 1:", "Página 2:", etc.
  const pagePattern = /(?:^|\n)(?:Página|Slide)\s*(\d+)[:.]?\s*([\s\S]*?)(?=(?:\n(?:Página|Slide)\s*\d)|---|\n\nLEGENDA:|$)/gi;
  let match;
  
  while ((match = pagePattern.exec(content)) !== null) {
    slides.push({
      id: `slide-${match[1]}`,
      text: match[2].trim(),
      media_urls: [],
    });
  }
  
  if (slides.length > 0) return slides;
  
  // Pattern 2: "---" separator
  const parts = content.split(/\n---\n/);
  if (parts.length > 1) {
    parts.forEach((part, idx) => {
      const text = part.trim();
      if (text && !text.toLowerCase().startsWith('legenda')) {
        slides.push({
          id: `slide-${idx + 1}`,
          text,
          media_urls: [],
        });
      }
    });
    if (slides.length > 0) return slides;
  }
  
  return null;
}
```

### 3. Usar Firecrawl para Links Genéricos

**Arquivo:** `supabase/functions/process-automations/index.ts`

Quando o usuário passa um link que não é RSS (ex: artigo do Medium), usar Firecrawl:

```typescript
async function scrapeContentFromUrl(url: string, supabaseUrl: string, supabaseKey: string): Promise<{
  title: string;
  content: string;
  images: string[];
} | null> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/firecrawl-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ 
        url,
        options: { 
          formats: ['markdown', 'links'],
          onlyMainContent: true 
        }
      }),
    });
    
    if (!response.ok) return null;
    
    const result = await response.json();
    if (!result.success) return null;
    
    return {
      title: result.data.metadata?.title || '',
      content: result.data.markdown || '',
      images: result.data.images || [],
    };
  } catch (error) {
    console.error('Firecrawl error:', error);
    return null;
  }
}
```

### 4. Labels de Tipo de Conteúdo

**Arquivo:** `supabase/functions/process-automations/index.ts`

```typescript
const CONTENT_TYPE_LABELS: Record<string, string> = {
  'tweet': 'Tweet (máx 280 chars)',
  'thread': 'Thread Twitter (5-10 tweets)',
  'x_article': 'Artigo no X (longo, profundo)',
  'linkedin_post': 'Post LinkedIn (profissional)',
  'carousel': 'Carrossel Instagram (8-10 slides)',
  'stories': 'Stories (5-7 stories)',
  'instagram_post': 'Post Instagram (legenda + visual)',
  'static_image': 'Post Estático (visual único)',
  'short_video': 'Roteiro Reels/TikTok (30-60s)',
  'long_video': 'Roteiro Vídeo Longo (5-15 min)',
  'newsletter': 'Newsletter (estruturada)',
  'blog_post': 'Blog Post (SEO-otimizado)',
  'case_study': 'Estudo de Caso',
  'report': 'Relatório',
};
```

### 5. Melhorar AutomationsTab com Ação Rápida de Teste

**Arquivo:** `src/components/automations/AutomationsTab.tsx`

Adicionar botão de "Testar Agora" diretamente na listagem:

```typescript
<DropdownMenuItem onClick={() => handleTestAutomation(automation.id)}>
  <Play className="h-4 w-4 mr-2" />
  Testar Agora
</DropdownMenuItem>
```

Com feedback visual:

```typescript
const [testingId, setTestingId] = useState<string | null>(null);

const handleTestAutomation = async (automationId: string) => {
  setTestingId(automationId);
  toast.info('Executando automação...');
  
  try {
    const { data, error } = await supabase.functions.invoke('process-automations', {
      body: { automationId }
    });
    
    if (error) throw error;
    
    if (data.triggered > 0) {
      toast.success('Automação executada! Card criado no planejamento.');
    } else {
      toast.info('Automação executada, mas nenhum card foi criado.');
    }
  } catch (err) {
    toast.error('Erro ao executar automação');
  } finally {
    setTestingId(null);
  }
};
```

### 6. Dialog de Histórico com Detalhes

**Arquivo:** `src/components/automations/AutomationHistoryDialog.tsx`

Mostrar mais detalhes de cada execução:

```typescript
<DialogContent className="max-w-2xl">
  {/* ... */}
  {runs.map((run) => (
    <div key={run.id} className="p-3 border rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant={getStatusVariant(run.status)}>
          {getStatusLabel(run.status)}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {formatDate(run.started_at)}
        </span>
      </div>
      
      {run.result && (
        <p className="text-sm">{run.result}</p>
      )}
      
      {run.error && (
        <p className="text-sm text-red-500">{run.error}</p>
      )}
      
      {run.trigger_data && (
        <div className="text-xs text-muted-foreground">
          <p>Fonte: {run.trigger_data.title}</p>
          {run.trigger_data.images_count > 0 && (
            <p>{run.trigger_data.images_count} imagens extraídas</p>
          )}
        </div>
      )}
      
      {run.duration_ms && (
        <p className="text-xs text-muted-foreground">
          Duração: {(run.duration_ms / 1000).toFixed(1)}s
        </p>
      )}
    </div>
  ))}
</DialogContent>
```

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-automations/index.ts` | Prompt enriquecido, parsing de carousel, labels de tipo |
| `src/components/automations/AutomationsTab.tsx` | Botão de teste rápido na listagem |
| `src/components/automations/AutomationHistoryDialog.tsx` | Exibir detalhes completos das execuções |
| `supabase/functions/kai-content-agent/format-rules.ts` | Ajustes nos mapeamentos (se necessário) |

---

## Resultado Esperado

1. **Prompt inteligente**: Quando o template está vazio ou simples, sistema cria prompt completo automaticamente
2. **Parsing de carousel**: Slides estruturados com imagens distribuídas
3. **Teste rápido**: Um clique para testar qualquer automação
4. **Histórico detalhado**: Ver exatamente o que aconteceu em cada execução
5. **Conteúdo de qualidade**: Format rules aplicadas corretamente com contexto do cliente
6. **Imagens automáticas**: Threads e carrosséis com imagens do RSS já distribuídas

---

## Testes Recomendados

Após implementação, testar:

1. **Thread com RSS**: Criar automação RSS → Thread → Verificar se tweets têm imagens
2. **Carousel com imagens**: Criar automação → Carousel → Verificar slides estruturados
3. **Tweet simples**: Verificar limite de 280 chars respeitado
4. **Template vazio**: Testar com prompt template vazio → deve gerar prompt inteligente
5. **Histórico**: Executar e verificar detalhes no dialog de histórico

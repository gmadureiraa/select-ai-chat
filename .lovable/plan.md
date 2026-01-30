
# Plano: Unificar Fluxo de Geração de Conteúdo

## Análise do Estado Atual

Existem **6 pontos** de geração de conteúdo na aplicação, cada um com implementações ligeiramente diferentes:

| Local | Hook/Arquivo | Usa kai-content-agent | Extrai Referência | Formato Rules |
|-------|--------------|----------------------|-------------------|---------------|
| Planning Dialog | `usePlanningContentGeneration.ts` | Sim (via callKaiContentAgent) | Sim (URLs, @mentions) | Via edge function |
| Canvas Generator | `useCanvasGeneration.ts` | Sim (fetch direto) | Sim (inputs conectados) | Via edge function |
| kAI Chat | `useClientChat.ts` | Sim (fetch direto) | Parcial (copywriting guide) | Via edge function |
| Content Creator | `useContentCreator.ts` | Sim (via callKaiContentAgent) | Sim (URLs, @mentions) | Via edge function |
| Automations | `process-automations/index.ts` | Sim (fetch interno) | Sim (RSS, Firecrawl) | Via edge function |
| Performance Report | `usePerformanceReport.ts` | Sim (supabase.functions.invoke) | N/A | Sem regras específicas |

## Problema Central

Cada local constrói o prompt de forma diferente e busca contexto de formas inconsistentes. Isso causa:

1. **Qualidade variável**: Alguns contextos são mais ricos que outros
2. **Manutenção difícil**: Mudanças precisam ser replicadas em 6 lugares
3. **Duplicação de código**: Lógica de extração de referência repetida

## Solução: Camada Unificada de Geração

Criar uma função utilitária centralizada que:
1. Padroniza a extração de referências (URLs, @mentions, texto)
2. Constrói prompts de forma consistente
3. Chama o `kai-content-agent` de forma uniforme
4. Retorna conteúdo + imagens extraídas

## Arquitetura Proposta

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    PONTOS DE ENTRADA (UI)                          │
├───────────────┬─────────────┬─────────────┬──────────────┬─────────┤
│ Planning      │ Canvas      │ kAI Chat    │ Content      │ Report  │
│ Dialog        │ Generator   │             │ Creator      │         │
└───────┬───────┴──────┬──────┴──────┬──────┴───────┬──────┴────┬────┘
        │              │             │              │           │
        ▼              ▼             ▼              ▼           ▼
┌───────────────────────────────────────────────────────────────────┐
│                   useUnifiedContentGeneration                      │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 1. extractAllReferences(input)                             │   │
│  │    - URLs → fetch-reference-content                        │   │
│  │    - @mentions → biblioteca                                │   │
│  │    - Texto adicional                                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 2. buildUnifiedPrompt(title, context, format, references)  │   │
│  │    - Labels consistentes por formato                       │   │
│  │    - Instruções específicas                                │   │
│  │    - Contexto de imagens                                   │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 3. callKaiContentAgent(prompt, clientId, format)           │   │
│  │    - Streaming ou non-streaming                            │   │
│  │    - Token error handling                                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 4. parseStructuredContent(content, format)                 │   │
│  │    - Thread → tweets array                                 │   │
│  │    - Carousel → slides array                               │   │
│  │    - Newsletter → sections                                 │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                       kai-content-agent                            │
│  - Já tem: format-rules.ts, contexto do cliente, top performers   │
│  - Já busca: identity_guide, content_library, references          │
└───────────────────────────────────────────────────────────────────┘
```

## Mudanças a Implementar

### 1. Criar Hook Centralizado: `useUnifiedContentGeneration.ts`

Este hook unifica toda a lógica comum:

```typescript
// src/hooks/useUnifiedContentGeneration.ts

interface GenerationInput {
  title: string;
  format: string;  // content_type
  clientId: string;
  referenceInput?: string;  // URLs, @mentions, texto adicional
  additionalContext?: string;  // Instruções extras
  images?: string[];  // Imagens já conhecidas
}

interface GenerationResult {
  content: string;
  images: string[];
  structuredContent?: {
    thread_tweets?: TweetItem[];
    carousel_slides?: SlideItem[];
  };
}

export function useUnifiedContentGeneration() {
  // Estados
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingReferences, setIsFetchingReferences] = useState(false);

  // Extração unificada de referências
  const extractReferences = async (input: string): Promise<{
    content: string;
    images: string[];
    sources: Array<{ type: string; title?: string }>;
  }> => {
    // 1. URLs → fetch-reference-content
    // 2. @mentions → biblioteca
    // 3. Texto limpo
  };

  // Construção unificada de prompt
  const buildPrompt = (params: {
    title: string;
    format: string;
    references?: string;
    additionalContext?: string;
    imageCount?: number;
  }): string => {
    // Labels consistentes por formato
    // Instruções específicas de formato
    // Contexto de imagens disponíveis
  };

  // Parsing estruturado por formato
  const parseContent = (content: string, format: string) => {
    // thread → parseThreadFromContent
    // carousel → parseCarouselFromContent
    // Distribuição automática de imagens
  };

  // Função principal
  const generate = async (input: GenerationInput): Promise<GenerationResult | null> => {
    // 1. Extrair referências
    // 2. Construir prompt
    // 3. Chamar kai-content-agent
    // 4. Parsear resultado
    // 5. Retornar estruturado
  };

  return { generate, isGenerating, isFetchingReferences };
}
```

### 2. Mover Lógica Comum para `src/lib/contentGeneration.ts`

Funções puras reutilizáveis (não-hooks):

```typescript
// src/lib/contentGeneration.ts

// Labels por formato (replicado do edge function)
export const CONTENT_TYPE_LABELS: Record<string, string> = { ... };

// Mapeamento format → platform
export const PLATFORM_MAP: Record<string, string> = { ... };

// Parser de thread
export function parseThreadFromContent(content: string): TweetItem[] | null { ... }

// Parser de carousel
export function parseCarouselFromContent(content: string): SlideItem[] | null { ... }

// Distribuir imagens entre itens
export function distributeImages(items: any[], images: string[], maxPerItem: number = 1) { ... }

// Construir prompt enriquecido
export function buildEnrichedPrompt(params: { ... }): string { ... }
```

### 3. Refatorar `usePlanningContentGeneration.ts`

Simplificar para usar o hook unificado:

```typescript
export function usePlanningContentGeneration() {
  const unified = useUnifiedContentGeneration();
  
  const generateContent = async (params: GenerateContentParams) => {
    return unified.generate({
      title: params.title,
      format: params.contentType,
      clientId: params.clientId,
      referenceInput: params.referenceInput,
    });
  };
  
  return {
    generateContent,
    isGenerating: unified.isGenerating,
    isFetchingReference: unified.isFetchingReferences,
  };
}
```

### 4. Refatorar `useContentCreator.ts`

Usar o hook unificado internamente:

```typescript
const generateForFormat = async (format, clientId, sourceData) => {
  const unified = useUnifiedContentGeneration();
  
  return unified.generate({
    title: sourceData.title,
    format: FORMAT_TO_CONTENT_TYPE[format],
    clientId,
    additionalContext: additionalContext,
    images: sourceData.images,
  });
};
```

### 5. Atualizar `useCanvasGeneration.ts`

Substituir a lógica inline pela chamada unificada:

```typescript
// Antes: ~100 linhas de lógica de stream parsing inline
// Depois:
const result = await callKaiContentAgent({
  clientId,
  request: userMessage,
  format: genData.format,
  accessToken,
});
```

### 6. Melhorar Edge Function `kai-content-agent`

Adicionar campo opcional `additionalMaterial` para passar referências já extraídas:

```typescript
interface ContentRequest {
  // ... campos existentes
  additionalMaterial?: string;  // Referências já extraídas pelo frontend
}

// No system prompt:
if (additionalMaterial) {
  contextPrompt += `\n### Material de Referência Fornecido\n${additionalMaterial}\n`;
}
```

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/lib/contentGeneration.ts` | Criar | Funções puras de parsing e construção de prompts |
| `src/hooks/useUnifiedContentGeneration.ts` | Criar | Hook centralizado de geração |
| `src/hooks/usePlanningContentGeneration.ts` | Refatorar | Usar hook unificado |
| `src/hooks/useContentCreator.ts` | Refatorar | Usar hook unificado |
| `src/hooks/useClientChat.ts` | Simplificar | Usar callKaiContentAgent do lib |
| `src/components/kai/canvas/hooks/useCanvasGeneration.ts` | Refatorar | Usar hook unificado |
| `supabase/functions/kai-content-agent/index.ts` | Melhorar | Aceitar additionalMaterial |

## Benefícios

1. **Consistência**: Todos os lugares geram conteúdo com a mesma qualidade
2. **Manutenção**: Uma única fonte de verdade para lógica de geração
3. **DRY**: Parsing de thread/carousel em um único lugar
4. **Extensibilidade**: Fácil adicionar novos formatos ou fontes de referência
5. **Debug**: Logs centralizados para debugging

## Testes Recomendados

Após implementação, testar em cada ponto de entrada:

1. **Planning Dialog**: Criar card com URL de YouTube → verificar conteúdo e imagens
2. **Canvas**: Gerar carrossel com múltiplos anexos → verificar slides
3. **kAI Chat**: Pedir thread sobre tema → verificar estrutura
4. **Content Creator**: Gerar múltiplos formatos de uma vez → verificar todos
5. **Automação**: Testar RSS → verificar parsing correto

## Ordem de Implementação

1. Criar `src/lib/contentGeneration.ts` com funções puras
2. Criar `src/hooks/useUnifiedContentGeneration.ts` 
3. Atualizar `kai-content-agent` para aceitar additionalMaterial
4. Refatorar `usePlanningContentGeneration.ts` (mais usado)
5. Refatorar `useContentCreator.ts`
6. Refatorar `useCanvasGeneration.ts`
7. Simplificar `useClientChat.ts`

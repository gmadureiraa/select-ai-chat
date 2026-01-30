
# Plano: Unificar Fluxo de Geração de Conteúdo

## ✅ Status: Em Implementação

## Progresso

| Arquivo | Status | Descrição |
|---------|--------|-----------|
| `src/lib/contentGeneration.ts` | ✅ Criado | Funções puras de parsing e construção de prompts |
| `src/hooks/useUnifiedContentGeneration.ts` | ✅ Criado | Hook centralizado de geração |
| `supabase/functions/kai-content-agent/index.ts` | ✅ Atualizado | Aceita additionalMaterial |
| `src/lib/parseOpenAIStream.ts` | ✅ Atualizado | Suporta additionalMaterial |
| `src/hooks/usePlanningContentGeneration.ts` | ✅ Refatorado | Usa hook unificado |
| `src/hooks/useContentCreator.ts` | ✅ Refatorado | Usa hook unificado |
| `src/components/kai/canvas/hooks/useCanvasGeneration.ts` | ⏳ Pendente | Usa hook unificado |
| `src/hooks/useClientChat.ts` | ⏳ Pendente | Simplificar para usar lib |

## Arquitetura Implementada

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    PONTOS DE ENTRADA (UI)                          │
├───────────────┬─────────────┬─────────────┬──────────────┬─────────┤
│ Planning      │ Canvas      │ kAI Chat    │ Content      │ Report  │
│ Dialog ✅     │ Generator   │             │ Creator ✅   │         │
└───────┬───────┴──────┬──────┴──────┬──────┴───────┬──────┴────┬────┘
        │              │             │              │           │
        ▼              ▼             ▼              ▼           ▼
┌───────────────────────────────────────────────────────────────────┐
│                   useUnifiedContentGeneration ✅                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 1. extractAllReferences(input) ✅                          │   │
│  │    - URLs → fetch-reference-content                        │   │
│  │    - @mentions → biblioteca                                │   │
│  │    - Texto adicional                                       │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 2. buildEnrichedPrompt(title, context, format, references) │   │
│  │    - Labels consistentes por formato ✅                    │   │
│  │    - Instruções específicas ✅                             │   │
│  │    - Contexto de imagens ✅                                │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 3. callKaiContentAgent(prompt, clientId, format) ✅        │   │
│  │    - Streaming via parseOpenAIStream                       │   │
│  │    - Token error handling                                  │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ 4. parseStructuredContent(content, format) ✅              │   │
│  │    - Thread → tweets array                                 │   │
│  │    - Carousel → slides array                               │   │
│  │    - Newsletter → sections                                 │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────┐
│                       kai-content-agent ✅                         │
│  - Suporta additionalMaterial                                     │
│  - format-rules.ts, contexto do cliente, top performers           │
│  - identity_guide, content_library, references                    │
└───────────────────────────────────────────────────────────────────┘
```

## Funções Criadas em `src/lib/contentGeneration.ts`

- `CONTENT_TYPE_LABELS` - Labels por formato
- `PLATFORM_MAP` - Mapeamento format → platform
- `fetchUrlContent()` - Busca conteúdo de URL
- `fetchMentionedContent()` - Busca conteúdo de @mentions
- `extractAllReferences()` - Extração unificada de referências
- `parseThreadFromContent()` - Parser de thread → TweetItem[]
- `parseCarouselFromContent()` - Parser de carousel → SlideItem[]
- `distributeImages()` - Distribuir imagens entre itens
- `buildEnrichedPrompt()` - Construir prompt enriquecido
- `parseStructuredContent()` - Parsing por formato
- `extractTitleFromContent()` - Extrair título do conteúdo
- `getPlatformFromFormat()` - Obter plataforma do formato

## Próximos Passos

1. ⏳ Refatorar `useCanvasGeneration.ts` para usar hook unificado
2. ⏳ Simplificar `useClientChat.ts`
3. 🧪 Testar fluxos em cada ponto de entrada



# Plano de Melhoria: Qualidade de Conteúdo + Docs nas Settings + Changelog

## Diagnóstico dos Problemas

### 1. Geração de Carrossel - Problemas Identificados
- **Modelo fraco**: Usa `gemini-2.0-flash` (modelo rápido/barato) para TODO conteúdo, incluindo carrosséis que precisam de qualidade superior
- **maxOutputTokens limitado**: Streaming usa apenas 4096 tokens - insuficiente para 10 slides bem escritos
- **Regras de formato superficiais**: As format-rules do carrossel têm apenas ~50 linhas; o doc `CARROSSEL.md` tem 347 linhas com muito mais profundidade mas NÃO é injetado no prompt
- **Parsing frágil**: `parseCarouselFromContent()` usa regex simples que falha se o modelo não seguir exatamente o padrão "Página X:" ou "Slide X:"
- **Sem validação pós-geração**: Não verifica se cada slide tem <= 30 palavras, se a capa tem <= 8 palavras, etc.
- **Prompt genérico**: O `buildEnrichedPrompt()` no frontend é básico demais - "Crie um carrossel sobre: [título]"

### 2. Docs não acessíveis no app
- Existe `src/pages/Documentation.tsx` com conteúdo hardcoded, mas NÃO está nas Settings
- Settings tem apenas 4 abas: Perfil, Time, Notificações, Aparência
- Documentação não tem changelog/datas

### 3. Pesquisa de Modelo Ideal para Carrosséis
Baseado na pesquisa realizada:
- **Claude Opus 4.5**: Melhor em escrita criativa e nuance, mas não disponível via Lovable AI Gateway
- **GPT-5.2**: Excelente em raciocínio estruturado e copy - disponível como `openai/gpt-5.2`
- **Gemini 2.5 Pro**: Bom em contexto longo + multimodal - disponível como `google/gemini-2.5-pro`
- **Recomendação**: Para carrosséis, usar `openai/gpt-5.2` ou `google/gemini-2.5-pro` (ambos disponíveis no gateway). GPT-5.2 é superior em copywriting estruturado (slides numerados, CTAs, ganchos).

O sistema já usa a Google AI Studio API diretamente. A melhoria é usar um modelo mais forte para formatos complexos.

---

## Implementação

### Fase 1: Carrossel Magnífico

**1.1 Upgrade de modelo por formato** (`kai-content-agent/index.ts`)
- Criar mapa de modelos por formato: formatos simples (tweet) → `gemini-2.0-flash`, formatos complexos (carousel, newsletter, blog_post) → `gemini-2.5-pro`
- Aumentar `maxOutputTokens` para 8192 em streaming para carrosséis
- Aumentar `temperature` para 0.8 em carrosséis (mais criatividade)

**1.2 Injetar doc completo do carrossel** (`kai-content-agent/index.ts`)
- Quando `format === 'carousel'`, carregar o conteúdo completo de `docs/formatos/CARROSSEL.md` via `kai_documentation` ou injetar diretamente as 347 linhas de regras no prompt em vez das 50 linhas atuais
- Substituir as format-rules hardcoded fracas pelas regras completas

**1.3 Melhorar format-rules do carrossel** (`format-rules.ts`)
- Expandir as regras de ~50 para ~150 linhas com:
  - Exemplos concretos de headlines que funcionam por nicho
  - Padrão de progressão narrativa (Problema → Agitação → Solução)
  - Regras de legenda (gancho na 1ª linha, CTA, sem hashtags)
  - Instruções claras de formatação de saída para parsing confiável

**1.4 Validação pós-geração** (`contentGeneration.ts`)
- Adicionar `validateCarouselContent()`:
  - Verificar <= 30 palavras por slide
  - Verificar capa <= 8 palavras no headline
  - Verificar mínimo 7 slides
  - Verificar presença de legenda
  - Se falhar, regenerar automaticamente com feedback específico

**1.5 Parser mais robusto** (`contentGeneration.ts`)
- Melhorar `parseCarouselFromContent()` com mais padrões:
  - "Página X:", "Slide X:", "**X.**", "📍", separadores "---"
  - Extrair LEGENDA separadamente
  - Detectar VISUAL RECOMENDADO por slide

### Fase 2: Documentação nas Settings

**2.1 Nova aba "Documentação" nas Settings** (`SettingsNavigation.tsx` + `Settings.tsx`)
- Adicionar seção "docs" ao `SettingsSection` type
- Renderizar conteúdo do `Documentation.tsx` inline nas settings
- Ícone: `BookOpen`

**2.2 Changelog em cada doc** (todos os `docs/*.md`)
- Adicionar header com data de última atualização em cada arquivo
- Formato: `> Última atualização: 09 de Março de 2026`

### Fase 3: Melhorias em outros formatos complexos
- Aplicar o mesmo upgrade de modelo para Newsletter e Blog Post
- Manter gemini-2.0-flash para tweets e posts curtos (custo-eficiente)

---

## Arquivos a modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/kai-content-agent/index.ts` | Seleção de modelo por formato, maxOutputTokens dinâmico |
| `supabase/functions/kai-content-agent/format-rules.ts` | Expandir regras do carrossel para ~150 linhas |
| `src/lib/contentGeneration.ts` | Parser robusto + validação pós-geração |
| `src/components/settings/SettingsNavigation.tsx` | Adicionar aba "Documentação" |
| `src/pages/Settings.tsx` | Renderizar seção de docs |
| `docs/*.md` (todos ~20 arquivos) | Adicionar changelog com data |


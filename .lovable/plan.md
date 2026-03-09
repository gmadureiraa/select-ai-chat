

# Plan: Upgrade Completo dos Prompts e Pipeline de IA

## Diagnóstico

Após análise detalhada de ~8000 linhas across 8 arquivos-chave, identifiquei problemas estruturais que degradam a qualidade do conteúdo:

### Problemas Encontrados

**1. Duplicação e fragmentação de prompts**
- `kai-content-agent` (545 linhas), `unified-content-api` (518 linhas), `generate-content-v2` (984 linhas) e `process-automations` (1949 linhas) TODOS constroem seus próprios system prompts de formas diferentes
- `kai-content-agent` monta contexto manualmente (linhas 166-280) em vez de usar `getFullContentContext()` que já existe no `knowledge-loader.ts`
- `generate-content-v2` NÃO usa `getStructuredVoice()` — o Voice Profile (Use/Avoid) é ignorado na geração de texto pelo canvas
- Resultado: regras inconsistentes entre Chat, Canvas e Automações

**2. `generate-content-v2` usa modelo desatualizado**
- Usa `gemini-2.0-flash` fixo (linha 465) sem distinção por complexidade do formato
- `kai-content-agent` já faz essa distinção (Pro para newsletter/carousel, Flash para tweets) mas `generate-content-v2` não
- Falta Voice Profile, Content Guidelines, Reference Library nesta edge function

**3. Quality rules não são aplicadas no `kai-content-agent`**
- `UNIVERSAL_OUTPUT_RULES` e `buildForbiddenPhrasesSection()` existem no `quality-rules.ts` mas NÃO são importados no `kai-content-agent`
- Apenas o `unified-content-api` usa o pipeline completo de validação (Writer → Validate → Repair → Review)
- O chat e o canvas geram conteúdo sem nenhuma validação pós-geração

**4. Prompts inflados e redundantes**
- O prompt do `process-automations` tem regras de tweet duplicadas: `buildEnrichedPrompt()` adiciona regras de formato (linha 560-577) E depois `getFullContentContext()` carrega as MESMAS regras novamente via `getFormatDocs()`
- `kai-content-agent` carrega `formatRulesContent` + `enrichmentContext` que se sobrepõem
- Prompts chegam a 20-30k tokens de contexto desnecessariamente

**5. Imagem: prompt de geração genérico**
- O prompt de imagem no `process-automations` (linha 1479) é uma string simples que não usa as instruções detalhadas do format schema
- Não aproveita o conteúdo gerado para criar um briefing visual mais rico
- A instrução "NO TEXT" é básica — deveria incluir exemplos negativos mais específicos

---

## Mudanças Propostas

### 1. Unificar construção de system prompt — `_shared/prompt-builder.ts` (NOVO)
Criar módulo centralizado que monta o system prompt para QUALQUER contexto (chat, canvas, automação):

```text
buildWriterSystemPrompt({
  clientId, format, workspaceId,
  includeVoice, includeLibrary, includePerformers,
  variationContext?, researchBriefing?
}) → string
```

Elimina duplicação nos 4 arquivos. Garante que TODAS as gerações usam:
- Voice Profile (Use/Avoid)
- Content Guidelines
- Format Rules (DB → fallback)
- Quality Rules (forbidden phrases)
- Universal Output Rules
- Library examples + Top Performers
- Global Knowledge

### 2. Injetar Voice Profile no `generate-content-v2`
- Importar e chamar `getStructuredVoice()` + `getClientAvoidList()`
- Adicionar Content Guidelines (`client.content_guidelines`)
- Aplicar `buildForbiddenPhrasesSection()` no prompt de texto

### 3. Injetar Quality Rules no `kai-content-agent`
- Importar `UNIVERSAL_OUTPUT_RULES` e `buildForbiddenPhrasesSection()`
- Adicionar no system prompt ANTES do contexto do cliente
- Remover regras hardcoded redundantes (linhas 338-372 que replicam parcialmente)

### 4. Upgrade do modelo no `generate-content-v2`
- Implementar a mesma lógica de seleção que `kai-content-agent` usa:
  - Pro para carousel, newsletter, blog, long_video, x_article
  - Flash para tweet, post, stories, reels

### 5. Otimizar tamanho dos prompts
- No `process-automations`, remover regras de formato duplicadas em `buildEnrichedPrompt()` (linhas 560-577) já que `getFullContentContext()` as carrega
- Limitar exemplos da biblioteca a 800 chars (alguns chegam a 1500)
- Limitar identity_guide a 6000 chars no contexto de automações (hoje 8000)

### 6. Melhorar prompt de geração de imagem
- Extrair temas-chave do conteúdo gerado (não só 200 chars)
- Adicionar instrução de composição baseada no formato (1:1 vs 16:9 vs 9:16)
- Reforçar instrução "sem texto" com exemplos negativos mais específicos
- Usar referências visuais como "style anchor" no prompt

---

## Technical Details

### Novo arquivo
**`supabase/functions/_shared/prompt-builder.ts`** (~200 linhas)
- `buildWriterSystemPrompt()` — Monta prompt completo
- `buildImageBriefing()` — Monta briefing visual contextual
- `selectModelForFormat()` — Retorna modelo + temperatura + maxTokens

### Arquivos modificados
1. **`supabase/functions/_shared/prompt-builder.ts`** — NOVO: módulo centralizado
2. **`supabase/functions/kai-content-agent/index.ts`** — Usar `buildWriterSystemPrompt()`, remover construção manual
3. **`supabase/functions/generate-content-v2/index.ts`** — Adicionar Voice Profile, Content Guidelines, Quality Rules, model selection
4. **`supabase/functions/process-automations/index.ts`** — Usar `buildWriterSystemPrompt()`, remover regras duplicadas em `buildEnrichedPrompt()`, melhorar prompt de imagem
5. **`supabase/functions/unified-content-api/index.ts`** — Usar `buildWriterSystemPrompt()` (já é o mais completo, menor mudança)

### Impacto esperado
- Conteúdo do canvas (generate-content-v2) respeita Voice Profile → qualidade sobe significativamente
- Prompts 30-40% menores → respostas mais rápidas e focadas
- Regras consistentes em TODOS os ambientes → fim de discrepâncias entre chat/canvas/automação
- Imagens mais contextuais e diversas


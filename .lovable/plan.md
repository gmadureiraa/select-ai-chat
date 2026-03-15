

# Melhorias Adicionais na Qualidade do Conteúdo

Após revisar todo o pipeline (quality-rules → prompt-builder → unified-content-api → process-automations → knowledge-loader), identifiquei 6 melhorias concretas que podem fazer diferença real:

---

## 1. Temperatura dinâmica por tipo de conteúdo

**Problema:** O writer usa temperatura fixa 0.7 para formatos simples. Tweets e threads que precisam de personalidade ficam "seguros demais".

**Solução:** Ajustar `selectModelForFormat()` em `prompt-builder.ts`:
- Tweets/Threads/Social: **0.9** (mais criativo, mais ousado)
- LinkedIn: **0.8** (profissional mas com personalidade)
- Newsletter/Blog: **0.7** (informativo, preciso)
- BTC Price updates: **0.6** (factual, pouca variação criativa)

---

## 2. Reviewer recebe Voice Profile do cliente

**Problema crítico:** O reviewer em `unified-content-api` NÃO recebe o voice profile do cliente. Ele pode "corrigir" conteúdo autêntico de volta para tom genérico — desfazendo o trabalho do writer.

**Solução:** Passar o voice profile para o reviewer system prompt, com instrução: "Preserve rigorosamente o tom e as expressões do cliente. NÃO 'melhore' linguagem que faz parte da voz autêntica."

---

## 3. Rotação aleatória com cooldown (em vez de sequencial)

**Problema:** As categorias de variação rotam sequencialmente (0, 1, 2, 3...). Isso cria padrões previsíveis — se há 8 categorias, a cada 8 posts o ciclo se repete identicamente.

**Solução:** Usar seleção aleatória ponderada com cooldown dos últimos 3 índices usados. Guardar `recent_variation_indices: [5, 2, 7]` no trigger_config e excluir esses da próxima seleção.

---

## 4. Variação de comprimento do conteúdo

**Problema:** Todos os tweets/posts tendem ao mesmo tamanho porque o prompt não instrui variação. Resultado: monotonia visual no feed.

**Solução:** Adicionar instrução de comprimento na variação editorial:
- 30% das vezes: "Máximo 2 frases. Brevidade é poder."
- 40% das vezes: tamanho normal
- 30% das vezes: "Desenvolva com 4-5 frases. Use detalhes."

Implementar como modificador adicional no `variationContext`.

---

## 5. Tracking de hooks de abertura

**Problema:** O `detectContentStructure()` analisa padrões gerais mas não rastreia as primeiras palavras dos posts. Se 5 dos últimos 7 posts começam com "Eu...", o sistema não detecta.

**Solução:** Adicionar detecção de padrão de abertura no anti-exemplo:
- Extrair as primeiras 3-5 palavras dos últimos 10 posts
- Agrupar por padrão ("Eu + verbo", "Pergunta", "Número", "Nome próprio", "Imperativo")
- Injetar no prompt: "Seus últimos posts abriram com: 'Eu fiz...', 'Eu percebi...', 'Eu testei...'. COMECE de forma diferente."

---

## 6. Aumentar anti-exemplos de 7 para 12

**Problema:** 7 anti-exemplos é pouco para clientes com 2-3 posts/dia. Em 2-3 dias já reciclou tudo.

**Solução:** Aumentar para 12 anti-exemplos nos queries de `twitter_posts` e `planning_items`, com substring maior (300 chars em vez de 200) para capturar melhor a estrutura completa.

---

## Arquivos a modificar

1. **`supabase/functions/_shared/prompt-builder.ts`** — Temperatura dinâmica por formato
2. **`supabase/functions/unified-content-api/index.ts`** — Injetar voice profile no reviewer
3. **`supabase/functions/process-automations/index.ts`** — Rotação aleatória com cooldown + variação de comprimento + aumentar anti-exemplos para 12
4. **`supabase/functions/_shared/quality-rules.ts`** — Adicionar `detectOpeningPatterns()` para tracking de hooks


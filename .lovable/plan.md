
# Evolução dos Criadores de Conteúdo: Canvas, kAI Chat e Automações

## Diagnóstico Atual

### O que FUNCIONA BEM

| Ambiente | Status | Usa Regras DB? | Usa Contexto Cliente? |
|----------|--------|----------------|----------------------|
| **kAI Chat** | ✅ Robusto | ✅ Sim | ✅ identity_guide + biblioteca |
| **Canvas** | ⚠️ Parcial | ✅ Sim (v2) | ✅ favorites + top performers |
| **Automações** | ⚠️ Parcial | ✅ Sim | ⚠️ Apenas prompt template |

### O que Pode Melhorar

1. **Knowledge Base Global** (`global_knowledge`)
   - Disponível no banco mas NÃO sendo usada em Canvas e Automações
   - Contém melhores práticas, tendências, insights estratégicos

2. **Checklist de Formatos**
   - Cada formato tem checklist de validação no banco (`kai_documentation.checklist`)
   - NÃO está sendo usado para validar output antes de entregar

3. **Contexto de Conversa no Canvas**
   - Generator nodes não mantém "memória" entre gerações
   - Não aproveita outputs anteriores como contexto acumulado

4. **Enriquecimento de Automações**
   - Automações usam prompt template simples
   - Não carregam exemplos favoritos nem top performers automaticamente

5. **Feedback Loop**
   - Conteúdos de alta performance não retroalimentam automaticamente os prompts

---

## Melhorias Propostas

### 1. Integrar Global Knowledge em Todos os Ambientes

**Arquivo:** `supabase/functions/_shared/knowledge-loader.ts`

Adicionar função para buscar conhecimento global do workspace:

```typescript
export async function getGlobalKnowledge(workspaceId: string, limit = 5): Promise<string> {
  const { data } = await supabase
    .from("global_knowledge")
    .select("title, summary, category, content")
    .eq("workspace_id", workspaceId)
    .limit(limit);
  
  if (!data?.length) return "";
  
  let context = "\n## 📚 BASE DE CONHECIMENTO GLOBAL\n";
  context += "*Use esses insights para enriquecer o conteúdo:*\n\n";
  
  for (const item of data) {
    context += `### ${item.title} (${item.category})\n`;
    context += item.summary || item.content?.substring(0, 500);
    context += "\n\n";
  }
  
  return context;
}
```

**Integrar em:**
- `kai-content-agent` ✅ (já tem parcialmente)
- `generate-content-v2` ❌ (adicionar)
- `process-automations` ❌ (adicionar)

### 2. Adicionar Validação com Checklist

**Arquivo:** `supabase/functions/_shared/knowledge-loader.ts`

Adicionar função para buscar e formatar checklist:

```typescript
export async function getFormatChecklist(format: string): Promise<string> {
  const doc = await fetchDocumentation('format', normalizeFormatKey(format));
  
  if (!doc?.checklist?.length) return "";
  
  let validation = "\n## ✅ CHECKLIST DE VALIDAÇÃO\n";
  validation += "*VERIFIQUE antes de finalizar:*\n\n";
  
  doc.checklist.forEach((item, i) => {
    validation += `${i + 1}. ${item}\n`;
  });
  
  return validation;
}
```

Incluir no prompt final para IA auto-validar o output.

### 3. Enriquecer Automações com Contexto Completo

**Arquivo:** `supabase/functions/process-automations/index.ts`

Na função de geração de conteúdo (linha ~690), antes de chamar `kai-content-agent`:

```typescript
// Buscar contexto enriquecido igual aos outros ambientes
const enrichedContext = await getFullContentContext({
  clientId: automation.client_id,
  format: format,
  includeLibrary: true,
  includeTopPerformers: true,
});

// Adicionar ao prompt
const enrichedPrompt = `${enrichedContext}\n\n${buildEnrichedPrompt(...)}`;
```

**Resultado:** Automações passam a usar:
- ✅ Regras do formato (do banco)
- ✅ identity_guide do cliente
- ✅ Exemplos favoritos da biblioteca
- ✅ Top performers (Instagram/YouTube)

### 4. Melhorar Canvas com Memória de Contexto

**Problema:** Cada geração é isolada, não aproveita gerações anteriores.

**Solução:** No `GeneratorNode.tsx`, passar outputs conectados como contexto:

```typescript
// Já implementado parcialmente (linhas 159-168)
// Melhorar para extrair mais contexto:

if (sourceNode?.type === 'output' && sourceNode.data?.content) {
  attachments.push({
    type: 'text',
    content: `[OUTPUT ANTERIOR - USE COMO CONTEXTO]\n${sourceNode.data.content}`,
    transcription: sourceNode.data.content,
  });
}
```

E no `generate-content-v2`, reconhecer e priorizar esses outputs:

```typescript
if (input.content?.startsWith('[OUTPUT ANTERIOR')) {
  context += `\n### 📎 CONTEXTO DE GERAÇÃO ANTERIOR:\n${input.content}\n`;
  context += "*Use este contexto para manter consistência e continuidade.*\n";
}
```

### 5. Criar Pipeline de Feedback Automático

**Nova função:** Quando um post tem alta performance, extrair padrões:

**Arquivo:** `supabase/functions/_shared/knowledge-loader.ts`

```typescript
export async function getSuccessPatterns(clientId: string): Promise<string> {
  // Buscar posts com engagement > média
  const { data: topPosts } = await supabase
    .from("instagram_posts")
    .select("caption, post_type, engagement_rate")
    .eq("client_id", clientId)
    .order("engagement_rate", { ascending: false })
    .limit(3);
  
  if (!topPosts?.length) return "";
  
  let patterns = "\n## 🎯 PADRÕES QUE FUNCIONAM PARA ESTE CLIENTE\n";
  patterns += "*Baseado em análise de posts de alta performance:*\n\n";
  
  for (const post of topPosts) {
    patterns += `- **${post.post_type}** com ${(post.engagement_rate * 100).toFixed(1)}% engagement\n`;
    if (post.caption) {
      // Extrair padrões do caption
      const hasQuestion = /\?/.test(post.caption);
      const hasEmojis = /[\u{1F600}-\u{1F6FF}]/u.test(post.caption);
      const hasCTA = /(coment|compartilh|salv|link|bio)/i.test(post.caption);
      
      if (hasQuestion) patterns += "  - Usa perguntas para engajar\n";
      if (hasEmojis) patterns += "  - Inclui emojis estrategicamente\n";
      if (hasCTA) patterns += "  - Tem CTA claro\n";
    }
  }
  
  return patterns;
}
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/_shared/knowledge-loader.ts` | Adicionar `getGlobalKnowledge`, melhorar `getFormatChecklist`, adicionar `getSuccessPatterns` |
| `supabase/functions/generate-content-v2/index.ts` | Integrar global knowledge + checklist de validação |
| `supabase/functions/process-automations/index.ts` | Usar `getFullContentContext` para enriquecer prompts |
| `supabase/functions/kai-content-agent/index.ts` | Adicionar checklist de validação no final do prompt |
| `src/components/kai/canvas/nodes/GeneratorNode.tsx` | Melhorar extração de contexto de outputs conectados |

---

## Fluxo Final Unificado

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CONTEXTO COMPLETO DA GERAÇÃO                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. 📋 REGRAS DO FORMATO (kai_documentation)                                │
│     • Estrutura obrigatória                                                 │
│     • Limites de caracteres/slides                                          │
│     • Proibições específicas                                                │
│     • Formato de entrega                                                    │
│                                                                             │
│  2. 🎯 CONTEXTO DO CLIENTE (identity_guide + context_notes)                 │
│     • Tom de voz                                                            │
│     • Público-alvo                                                          │
│     • Posicionamento                                                        │
│     • Diretrizes de estilo                                                  │
│                                                                             │
│  3. 📚 EXEMPLOS DA BIBLIOTECA (favoritos)                                   │
│     • 3-5 conteúdos favoritos do mesmo formato                              │
│     • Estrutura e tom para replicar                                         │
│                                                                             │
│  4. 🏆 TOP PERFORMERS (Instagram + YouTube)                                 │
│     • Posts com melhor engagement                                           │
│     • O que funciona para este cliente                                      │
│                                                                             │
│  5. 📖 GLOBAL KNOWLEDGE (base de conhecimento)                              │
│     • Melhores práticas do setor                                            │
│     • Tendências e insights estratégicos                                    │
│     • Metodologias e frameworks                                             │
│                                                                             │
│  6. 📎 MATERIAL DE REFERÊNCIA (se fornecido)                                │
│     • URLs extraídas                                                        │
│     • @mentions citados                                                     │
│     • Transcrições/briefings                                                │
│     • Outputs anteriores conectados                                         │
│                                                                             │
│  7. ✅ CHECKLIST DE VALIDAÇÃO                                               │
│     • Auto-verificação antes de entregar                                    │
│     • Garantir conformidade com regras do formato                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Seção Técnica

### Ordem de Implementação

1. **Expandir `knowledge-loader.ts`** (30 min)
   - Adicionar `getGlobalKnowledge()`
   - Melhorar `getFormatChecklist()` para retornar string formatada
   - Adicionar `getSuccessPatterns()` (análise de padrões)

2. **Atualizar `generate-content-v2`** (20 min)
   - Importar e usar novas funções
   - Adicionar global knowledge ao prompt
   - Incluir checklist de validação

3. **Atualizar `process-automations`** (30 min)
   - Importar `getFullContentContext`
   - Substituir prompt simples por contexto enriquecido
   - Garantir que automações usem mesma qualidade de contexto

4. **Atualizar `kai-content-agent`** (15 min)
   - Adicionar checklist de validação no prompt
   - Garantir que global knowledge seja buscada

5. **Melhorar `GeneratorNode.tsx`** (20 min)
   - Melhorar extração de contexto de outputs conectados
   - Adicionar label visual mostrando "contexto acumulado"

6. **Redeploy das Edge Functions** (5 min)
   - `generate-content-v2`
   - `process-automations`
   - `kai-content-agent`

### Tempo Total Estimado: ~2 horas

### Resultado Final

Após as melhorias:
- **Canvas**: Contexto completo + memória de outputs anteriores + validação
- **kAI Chat**: Contexto completo (já tem) + global knowledge + validação
- **Automações**: Contexto completo igual aos outros + enriquecimento automático

Todos os ambientes usarão a mesma fonte de verdade (`kai_documentation`) e terão acesso ao contexto rico do cliente, garantindo consistência e qualidade em toda geração de conteúdo.

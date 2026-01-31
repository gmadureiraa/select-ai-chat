
# Unificação do Contexto de Formatos em TODOS os Ambientes

## Diagnóstico

### Situação Atual - PROBLEMA IDENTIFICADO

O sistema possui **16 formatos documentados** no banco de dados (`kai_documentation`), porém:

| Ambiente | Usa `kai_documentation`? | Como Carrega Formato? |
|----------|--------------------------|------------------------|
| **kAI Chat** (`kai-simple-chat`) | ✅ SIM | Busca diretamente do banco |
| **kai-content-agent** | ⚠️ PARCIAL | Usa `format-rules.ts` (hardcoded) |
| **Canvas** | ⚠️ PARCIAL | Passa formato para `kai-content-agent` |
| **Planejamento** | ⚠️ PARCIAL | Usa `kai-content-agent` via hook |
| **generate-content-v2** | ❌ NÃO | Usa apenas `format-rules.ts` |

### O Problema Principal

Existem **DUAS fontes de documentação de formato**:

1. **Banco de dados** (`kai_documentation`) - 16 formatos com documentação estratégica rica
2. **Código hardcoded** (`format-rules.ts`) - Regras básicas que podem estar desatualizadas

A função `knowledge-loader.ts` foi criada para carregar do banco, mas **NÃO está sendo usada** pelos agentes principais!

### Impacto

- A IA pode receber regras diferentes dependendo de qual caminho chama
- Atualizações no banco não refletem em todos os fluxos
- Documentação fragmentada = comportamento inconsistente

---

## Solução Proposta

### Arquitetura Unificada

```
┌──────────────────────────────────────────────────────────────────┐
│                    FLUXO UNIFICADO DE CONTEXTO                   │
└──────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │     kai_documentation       │
                 │     (FONTE ÚNICA)           │
                 │  • 16 formatos documentados │
                 │  • Atualizado via banco     │
                 └─────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │ kAI Chat    │     │ kai-content │     │ generate-   │
    │             │     │ -agent      │     │ content-v2  │
    └─────────────┘     └─────────────┘     └─────────────┘
            │                   │                   │
            └───────────────────┼───────────────────┘
                                │
                                ▼
                 ┌─────────────────────────────┐
                 │  + identity_guide (cliente) │
                 │  + biblioteca de exemplos   │
                 │  + top performers           │
                 └─────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────┐
                    │  CONTEXTO FINAL   │
                    │  para Gemini      │
                    └───────────────────┘
```

---

## Implementação Técnica

### 1. Atualizar `kai-content-agent` para Usar Banco

Modificar para buscar regras de formato do `kai_documentation` em vez de usar apenas `format-rules.ts`:

```typescript
// Atual (linha ~280-300 de kai-content-agent/index.ts)
const formatSpecificRules = getFormatRules(format || "post");

// Novo: Buscar do banco primeiro, fallback para hardcoded
let formatRulesContent = "";

if (format) {
  const { data: formatDoc } = await supabase
    .from("kai_documentation")
    .select("content")
    .eq("doc_type", "format")
    .eq("doc_key", normalizeFormatKey(format))
    .maybeSingle();
  
  if (formatDoc?.content) {
    formatRulesContent = `\n## 📋 Regras do Formato: ${format.toUpperCase()}\n${formatDoc.content}\n`;
  } else {
    // Fallback para hardcoded
    formatRulesContent = getFormatRules(format);
  }
}
```

### 2. Atualizar `generate-content-v2` para Usar Banco

Mesmo padrão:

```typescript
// Adicionar importação
import { getFormatDocs } from "../_shared/knowledge-loader.ts";

// Antes de gerar, buscar formato
let formatContext = "";
if (config.format) {
  formatContext = await getFormatDocs(config.format);
}
```

### 3. Criar Função Utilitária Unificada

Adicionar ao `knowledge-loader.ts` uma função que combina tudo:

```typescript
export async function getFullContentContext(params: {
  clientId: string;
  format: string;
  includeLibrary?: boolean;
  includeTopPerformers?: boolean;
}): Promise<string> {
  const { clientId, format, includeLibrary = true, includeTopPerformers = true } = params;
  
  let context = "";
  
  // 1. Regras do formato (do banco)
  const formatDocs = await getFormatDocs(format);
  if (formatDocs) {
    context += `## 📋 REGRAS DO FORMATO: ${format.toUpperCase()}\n\n${formatDocs}\n\n`;
  }
  
  // 2. Contexto do cliente (identity_guide)
  const { data: client } = await supabase
    .from("clients")
    .select("name, identity_guide, description")
    .eq("id", clientId)
    .single();
  
  if (client?.identity_guide) {
    context += `## 🎯 CONTEXTO DO CLIENTE\n\n${client.identity_guide}\n\n`;
  } else if (client?.description) {
    context += `## Cliente: ${client.name}\n${client.description}\n\n`;
  }
  
  // 3. Exemplos da biblioteca (opcional)
  if (includeLibrary) {
    // Buscar exemplos favoritos do mesmo formato
    // ...
  }
  
  // 4. Top performers (opcional)
  if (includeTopPerformers) {
    // Buscar posts com melhor engagement
    // ...
  }
  
  return context;
}
```

### 4. Sincronizar `format-rules.ts` com Banco

Manter o arquivo como **fallback** mas adicionar aviso de que a fonte primária é o banco:

```typescript
// format-rules.ts
// ⚠️ ATENÇÃO: A documentação primária está em kai_documentation (banco de dados)
// Este arquivo é usado apenas como FALLBACK quando o banco não está disponível
// Para atualizar regras, edite diretamente no banco via kai_documentation

export const FORMAT_RULES: Record<string, string> = {
  // ... (manter como fallback)
};
```

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `supabase/functions/kai-content-agent/index.ts` | Buscar formato do banco antes de usar hardcoded |
| `supabase/functions/generate-content-v2/index.ts` | Importar e usar `getFormatDocs` |
| `supabase/functions/_shared/knowledge-loader.ts` | Adicionar `getFullContentContext` |
| `supabase/functions/_shared/format-rules.ts` | Adicionar comentário de deprecação |

---

## Contexto Completo na Geração

Após as mudanças, TODA geração de conteúdo terá:

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTEXTO ENVIADO PARA A IA (em qualquer ambiente)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 1. 📋 REGRAS DO FORMATO (do kai_documentation)                  │
│    • Estrutura obrigatória                                      │
│    • Limites de caracteres/slides                               │
│    • Proibições específicas                                     │
│    • Exemplos de entrega                                        │
│                                                                 │
│ 2. 🎯 CONTEXTO DO CLIENTE (do identity_guide)                   │
│    • Tom de voz                                                 │
│    • Público-alvo                                               │
│    • Posicionamento                                             │
│    • Diretrizes de estilo                                       │
│                                                                 │
│ 3. 📚 EXEMPLOS DA BIBLIOTECA (opcional)                         │
│    • 3-5 conteúdos favoritos do mesmo formato                   │
│    • Estrutura e tom para replicar                              │
│                                                                 │
│ 4. 📊 TOP PERFORMERS (opcional)                                 │
│    • Posts com melhor engagement                                │
│    • O que funciona para este cliente                           │
│                                                                 │
│ 5. 📎 MATERIAL DE REFERÊNCIA (se fornecido)                     │
│    • URLs extraídas                                             │
│    • @mentions citados                                          │
│    • Transcrições/briefings                                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefícios

1. **Consistência**: Mesmas regras em Chat, Canvas, Planejamento e Automações
2. **Manutenção Central**: Atualizar formato no banco reflete em todos os lugares
3. **Retroalimentação**: O sistema sempre usa a documentação mais atualizada
4. **Fallback Seguro**: Se o banco falhar, usa o código hardcoded

---

## Ordem de Execução

1. Atualizar `kai-content-agent` para buscar do banco (prioridade alta)
2. Atualizar `generate-content-v2` para usar `knowledge-loader.ts`
3. Criar função `getFullContentContext` unificada
4. Adicionar comentário de deprecação em `format-rules.ts`
5. Redeploy das edge functions

## Tempo Estimado

| Tarefa | Tempo |
|--------|-------|
| Modificar `kai-content-agent` | 20 min |
| Modificar `generate-content-v2` | 15 min |
| Criar `getFullContentContext` | 25 min |
| Testes e ajustes | 20 min |
| **Total** | ~1h 20min |

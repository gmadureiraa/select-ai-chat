
# Melhorias Adicionais para Criação de Conteúdo

## Visão Geral

Após análise detalhada do sistema, identifiquei oportunidades significativas de melhoria em **3 áreas principais**:

1. **Sincronização de Regras** - A `generate-content-v2` (Canvas) usa prompts diferentes do `kai-content-agent` (Chat/Planning)
2. **Carregamento de Documentação** - As regras do `kai_documentation` não são usadas no Canvas
3. **Qualidade do Contexto** - Oportunidades de enriquecer o contexto passado para a IA

---

## Problema 1: Duas Fontes de Regras Diferentes

### Situação Atual

| Componente | Fonte de Regras | Problema |
|------------|-----------------|----------|
| `kai-content-agent` | `format-rules.ts` (regras detalhadas com UNIVERSAL_RULES) | Regras completas ✓ |
| `generate-content-v2` | Prompts inline hardcoded | Regras básicas e desatualizadas ✗ |

O Canvas usa `generate-content-v2` que tem prompts simplificados, enquanto o Chat usa `kai-content-agent` com regras completas. Isso causa inconsistência na qualidade.

### Solução

Unificar a fonte de regras importando `format-rules.ts` no `generate-content-v2`:

```typescript
// generate-content-v2/index.ts
import { getFormatRules } from "../kai-content-agent/format-rules.ts";

// Substituir formatPrompts hardcoded por:
const formatRules = getFormatRules(config.format || "post");
```

---

## Problema 2: kai_documentation Não Usada no Canvas

### Situação Atual

O banco `kai_documentation` tem 16 formatos documentados com regras detalhadas, mas:
- `kai-simple-chat` consulta → ✓
- `kai-content-agent` não consulta (usa format-rules.ts) → ⚠️
- `generate-content-v2` não consulta → ✗

### Solução

Duas opções:

**Opção A (Recomendada)**: Manter `format-rules.ts` como fonte principal (já completo e testado), mas sincronizar periodicamente com `kai_documentation`.

**Opção B**: Fazer `generate-content-v2` carregar regras do banco dinamicamente.

---

## Problema 3: Contexto Mais Rico para o Canvas

### Melhorias Propostas

1. **Buscar conteúdos favoritos do cliente** (como `kai-content-agent` faz)
2. **Incluir top performers** do Instagram/YouTube
3. **Aplicar UNIVERSAL_RULES** (proibição de meta-texto, hashtags)

---

## Implementação Proposta

### Fase 1: Unificar Regras no generate-content-v2

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/generate-content-v2/index.ts` | Importar e usar `getFormatRules()` ao invés de prompts inline |
| `supabase/functions/_shared/format-rules.ts` | Mover format-rules.ts para _shared (reutilizável) |

### Fase 2: Enriquecer Contexto no Canvas

| Arquivo | Mudança |
|---------|---------|
| `generate-content-v2/index.ts` | Buscar conteúdos favoritos (até 3) para referência de estilo |
| `generate-content-v2/index.ts` | Buscar top performers (até 3) para inspiração |
| `generate-content-v2/index.ts` | Adicionar UNIVERSAL_RULES no system prompt |

### Fase 3: Melhorias de UX no GeneratorNode

| Arquivo | Mudança |
|---------|---------|
| `GeneratorNode.tsx` | Mostrar preview das regras do formato selecionado |
| `GeneratorNode.tsx` | Adicionar opção "Consultar biblioteca" toggle |

---

## Arquivos a Modificar

1. **`supabase/functions/_shared/format-rules.ts`** (novo)
   - Mover conteúdo de `kai-content-agent/format-rules.ts`
   - Exportar `FORMAT_RULES`, `UNIVERSAL_RULES`, `getFormatRules()`

2. **`supabase/functions/kai-content-agent/index.ts`**
   - Atualizar import para `../_shared/format-rules.ts`

3. **`supabase/functions/generate-content-v2/index.ts`**
   - Importar regras de `../_shared/format-rules.ts`
   - Substituir `formatPrompts` hardcoded
   - Adicionar busca de conteúdos favoritos
   - Aplicar UNIVERSAL_RULES

---

## Benefícios Esperados

| Métrica | Antes | Depois |
|---------|-------|--------|
| Consistência entre Canvas e Chat | Regras diferentes | Mesmas regras |
| Qualidade no Canvas | Prompts básicos | Regras detalhadas + exemplos |
| Meta-texto indesejado | Possível aparecer | Bloqueado por UNIVERSAL_RULES |
| Hashtags | Podem aparecer | Globalmente proibidas |
| Contexto do cliente | Apenas brand_assets | + Favoritos + Top performers |

---

## Seção Técnica

### Estrutura de Imports

```
supabase/functions/
├── _shared/
│   ├── format-rules.ts      ← Nova localização (compartilhada)
│   ├── format-constants.ts  ← Já existe
│   └── knowledge-loader.ts  ← Já existe
├── kai-content-agent/
│   └── index.ts             ← Import de _shared/format-rules
├── generate-content-v2/
│   └── index.ts             ← Import de _shared/format-rules
```

### Fallback de Compatibilidade

Se o import falhar por algum motivo, manter prompts inline como fallback:

```typescript
let formatRules: string;
try {
  formatRules = getFormatRules(config.format || "post");
} catch {
  formatRules = formatPrompts[config.format || "post"] || formatPrompts.post;
}
```

### Performance

- Não há impacto de performance (import estático)
- Busca de favoritos/top performers já é feita em paralelo
- Limite de 3 itens cada para não sobrecarregar contexto

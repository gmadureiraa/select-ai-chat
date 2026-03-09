

# Plano: Unificar Regras de Formato + Imagens com Referências Visuais

## Diagnóstico

### Problema 1: kAI Chat usa regras de formato separadas
O `kai-simple-chat` carrega regras da tabela `kai_documentation` (linhas 2112-2118), **não** do `format-rules.ts`. Isso significa que as regras que você vê na documentação NÃO são as mesmas que o chat usa para gerar conteúdo.

**Solução:** Fazer o `kai-simple-chat` importar e usar `getFormatRules()` do `_shared/format-rules.ts` como fallback principal, usando `kai_documentation` apenas como complemento opcional.

### Problema 2: Geração de imagem no Planning não usa referências visuais
O `usePlanningImageGeneration.ts` chama uma edge function `generate-image` que **não existe** no projeto. Além disso, monta o prompt localmente sem buscar `client_visual_references`.

A automação do Madureira funciona bem porque `process-automations` → `generate-content-v2` busca referências visuais da tabela `client_visual_references`, passa as imagens reais como input multimodal para o Gemini, e usa o modelo Pro quando há referências.

**Solução:** Redirecionar o Planning para usar `generate-content-v2` com `type: 'image'`, que já tem todo o pipeline de referências visuais implementado.

---

## Implementação

### Fase 1: kAI Chat usa format-rules.ts

**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

1. Importar `getFormatRules` do `_shared/format-rules.ts`
2. Na seção de content creation context (linhas ~2092-2120), substituir a query à `kai_documentation` pelo `getFormatRules(detectedFormat)` como fonte principal
3. Manter `kai_documentation` como enriquecimento adicional (checklist etc.), mas as regras vêm do `format-rules.ts`

### Fase 2: Planning usa generate-content-v2 para imagens

**Arquivo:** `src/hooks/usePlanningImageGeneration.ts`

1. Trocar a chamada de `supabase.functions.invoke('generate-image')` para `supabase.functions.invoke('generate-content-v2')`
2. Montar o payload no formato correto: `{ type: 'image', inputs: [...], config: { ... }, clientId }`
3. O `generate-content-v2` já faz automaticamente:
   - Busca `client_visual_references` do cliente
   - Passa imagens reais como input multimodal
   - Usa modelo Pro (`gemini-3-pro-image-preview`) quando há referências
   - Aplica regra "sem texto" com retry
   - Upload automático para storage

### Fase 3: Canvas e Chat também usam generate-content-v2

**Arquivos:** `src/components/kai/canvas/hooks/useCanvasGeneration.ts`, `src/hooks/useClientChat.ts`

Mesma mudança: redirecionar de `generate-image` (inexistente) para `generate-content-v2`.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/kai-simple-chat/index.ts` | Importar e usar `getFormatRules()` para regras de formato |
| `src/hooks/usePlanningImageGeneration.ts` | Usar `generate-content-v2` com referências visuais |
| `src/components/kai/canvas/hooks/useCanvasGeneration.ts` | Usar `generate-content-v2` |
| `src/hooks/useClientChat.ts` | Usar `generate-content-v2` |

## Resultado Esperado
- Alterar regras em `format-rules.ts` = alterar comportamento do chat, canvas e planning
- Imagens geradas no planning usam DNA visual do cliente (como automações)
- Uma única edge function para todas as gerações de imagem


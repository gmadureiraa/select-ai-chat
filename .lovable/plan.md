
# Plano: Corrigir Geração de Conteúdo no kAI Chat

## Problema Identificado

A resposta do kAI Chat ao pedir "Gere um conteúdo de LinkedIn" não está gerando o conteúdo real - está retornando descrições abstratas sobre imagens ou respostas confusas.

**Causas raiz identificadas:**

1. **O modo selecionado via `ModeSelector` é IGNORADO pelo `FloatingInput`** - ele determina o modo apenas pelas citações
2. **O pipeline `unified-content-api` só é acionado quando `quality === "high"`**, mas a lógica está sobrescrevendo isso
3. **Ao chamar sem citação de formato explícita (`@LinkedIn`)**, o sistema cai no fluxo "híbrido" genérico que usa o `chat` comum em vez do pipeline especializado

---

## Correções Necessárias

### Correção 1: Passar modo do seletor para FloatingInput

O `KaiAssistantTab` usa `ModeSelector` que define `chatMode`, mas o `FloatingInput` não recebe esse modo atual.

**Mudanças:**
- Adicionar prop `selectedMode` ao `FloatingInput`
- Usar o modo selecionado COMO BASE, citações podem sobrescrevê-lo

```text
Lógica corrigida:
1. Modo base = selecionado pelo ModeSelector
2. Se tem citação de formato → modo "content"
3. Se tem citação "@ideias" → modo "ideas"
4. Caso contrário → usa modo base
```

---

### Correção 2: Garantir que modo "content" SEMPRE use unified-content-api

No `useClientChat.ts`, quando `explicitMode === "content"`:
- Forçar `shouldUseMultiAgent = true`
- Garantir que o pipeline especializado seja usado

```text
// Antes
const shouldUseMultiAgent = !isExplicitIdeaMode && (
  quality === "high" || ...
);

// Depois
const isExplicitContentMode = explicitMode === "content";
const shouldUseMultiAgent = !isExplicitIdeaMode && (
  isExplicitContentMode ||  // ← NOVO: modo explícito de conteúdo
  quality === "high" || ...
);
```

---

### Correção 3: Processar resposta JSON da unified-content-api corretamente

A `unified-content-api` retorna JSON estruturado:
```json
{
  "content": "...",
  "parsed_fields": {...},
  "validation": {...},
  "sources_used": {...}
}
```

Mas o código atual tenta parsear como stream SSE. Precisa:
1. Detectar se a resposta é JSON
2. Extrair o campo `content`
3. Passar `sources_used` e `validation` para o payload da mensagem

---

### Correção 4: Melhorar detecção de formato no prompt do usuário

Quando o usuário digita "Gere um conteúdo de LinkedIn para mim", o sistema deveria detectar automaticamente que é um pedido de conteúdo LinkedIn mesmo sem `@LinkedIn`.

Ampliar a função `detectContentType` para:
- Detectar "conteúdo de linkedin" → `linkedin_post`
- Detectar "conteúdo pra linkedin" → `linkedin_post`
- Detectar "post linkedin" → `linkedin_post`
- Etc.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/chat/FloatingInput.tsx` | Receber `selectedMode` como prop e usá-lo como base |
| `src/components/kai/KaiAssistantTab.tsx` | Passar `chatMode` para FloatingInput |
| `src/hooks/useClientChat.ts` | Forçar pipeline quando `explicitMode === "content"` |
| `src/hooks/useClientChat.ts` | Corrigir parsing da resposta JSON da unified-content-api |
| `src/types/template.ts` | Melhorar `detectContentType` para detectar mais variações |

---

## Fluxo Corrigido

Quando usuário está em modo **Conteúdo** e digita "Gere um conteúdo de LinkedIn para mim":

```text
1. FloatingInput detecta modo = "content" (do ModeSelector)
2. quality = "high" (modo content sempre usa alta qualidade)
3. useClientChat recebe explicitMode = "content"
4. shouldUseMultiAgent = true (modo explícito de conteúdo)
5. Chama unified-content-api com:
   - format: "linkedin" (detectado do texto)
   - brief: "Gere um conteúdo de LinkedIn para mim"
6. Resposta JSON é parseada:
   - content → exibido no chat
   - sources_used → exibido no SourcesBadge
   - validation → exibido no ValidationBadge
7. Conteúdo final: post LinkedIn completo e formatado
```

---

## Resultado Esperado

Após as correções:

**Entrada:** "Gere um conteúdo de linkedin para mim" (modo Conteúdo selecionado)

**Saída esperada:**
```text
📚 Fontes: Guia de Identidade • 2 itens biblioteca

[Gancho de 1 linha - aparece antes do "ver mais"]

[Espaço]

[Parágrafo 1 - Contexto ou história baseada no cliente]

[Espaço]

[Parágrafos 2-4 - Desenvolvimento com insights]

[Espaço]

[CTA: Pergunta que gera comentários]

---
💡 Ideia de imagem:
[Descrição visual relacionada ao tema]

✓ Validado automaticamente

👍 Usar │ ✏️ Editar │ ↻ Refazer │ 📌 Salvar
```

---

## Seção Técnica

### Mudanças específicas no código:

#### FloatingInput.tsx (linhas ~60 e ~213-220):
```typescript
// Props
interface FloatingInputProps {
  // ... existentes
  selectedMode?: ChatMode; // ← NOVO
}

// No handleSubmit:
let effectiveMode: ChatMode;
if (citations.some(c => c.category === "ideias" || c.id === "format_ideias")) {
  effectiveMode = "ideas";
} else if (citations.some(c => c.type === "format")) {
  effectiveMode = "content";
} else {
  effectiveMode = selectedMode || mode; // ← USA MODO SELECIONADO
}
```

#### useClientChat.ts (linhas ~1181):
```typescript
const isExplicitContentMode = explicitMode === "content";
const shouldUseMultiAgent = !isExplicitIdeaMode && (
  isExplicitContentMode || // ← NOVO
  quality === "high" || 
  extractedUrlContent !== null ||
  (MULTI_AGENT_CONTENT_TYPES.includes(earlyDetectedType || "") &&
  (selectedModel.includes("pro") || selectedModel.includes("gpt-5")))
);
```

#### useClientChat.ts (linhas ~1255-1285):
```typescript
// Processar resposta - detectar se é JSON ou stream
if (response.headers.get("content-type")?.includes("application/json")) {
  // Resposta JSON da unified-content-api
  const jsonResponse = await response.json();
  finalContent = jsonResponse.content;
  // Salvar com metadados
  await supabase.from("messages").insert({
    // ...
    payload: {
      sources_used: jsonResponse.sources_used,
      format_type: jsonResponse.metadata?.format,
      validation: jsonResponse.validation,
    },
  });
} else {
  // Resposta SSE (stream)
  finalContent = await parseOpenAIStream(reader, {...});
}
```

#### template.ts - detectContentType:
```typescript
// Adicionar mais padrões para LinkedIn
if (
  lowerContent.includes("linkedin") ||
  lowerContent.includes("post linkedin") ||
  lowerContent.includes("conteúdo de linkedin") ||
  lowerContent.includes("conteúdo pra linkedin") ||
  lowerContent.includes("publicação linkedin")
) {
  return "linkedin_post";
}
```

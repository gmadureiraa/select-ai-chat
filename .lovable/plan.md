
# Plano: Corrigir Prioridade do Modo Explícito no kAI Chat

## Problema Identificado

O kAI Chat não está gerando conteúdo de texto porque:

1. **Fluxo de detecção de imagem tem prioridade sobre modo explícito**: A verificação `detectImageGenerationRequest()` acontece ANTES de verificar se `explicitMode === "content"`.

2. **Quando o usuário seleciona "Conteúdo" e digita algo como "Gere um conteúdo..."**, o fluxo pode cair erroneamente em outros handlers (imagem, chat livre, etc.) ao invés do pipeline `unified-content-api`.

3. **Logs confirmam o problema**: A resposta no banco de dados mostra que a IA falou sobre "sugerir uma imagem" quando o usuário pediu conteúdo de LinkedIn.

## Causa Raiz

No arquivo `src/hooks/useClientChat.ts`, a ordem de verificações é:
```text
1. Verificar se é pedido de IMAGEM (linha ~420)
2. Verificar se tem URL
3. Verificar se é modo FREE_CHAT  
4. Verificar se é modo IDEAS
5. Finalmente, verificar se deve usar multi-agente (linha ~1180)
```

Quando `explicitMode === "content"`, o fluxo deveria ir DIRETO para o pipeline multi-agente, ignorando as verificações de imagem e URL.

---

## Correção Proposta

### Mudança Principal: Priorizar Modo Explícito

No início do fluxo de `sendMessage`, adicionar verificação de modo explícito ANTES de todas as outras:

```text
NOVO FLUXO:
1. Se explicitMode === "content" → IR DIRETO para pipeline multi-agente
2. Se explicitMode === "ideas" → IR DIRETO para pipeline de ideias
3. Se explicitMode === "image" → Gerar imagem
4. Caso contrário → Continuar com detecção automática (URL, imagem, etc.)
```

### Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useClientChat.ts` | Reordenar verificações para priorizar modo explícito |

### Código a Alterar

**Localização**: `src/hooks/useClientChat.ts`, linhas ~390-420 (após salvar mensagem do usuário)

Inserir verificação de modo content ANTES da verificação de imagem:

```typescript
// NOVA VERIFICAÇÃO: Modo content explícito vai DIRETO para pipeline multi-agente
// Isso garante que quando o usuário seleciona "Conteúdo", 
// o sistema SEMPRE usa o pipeline de alta qualidade
if (explicitMode === "content") {
  console.log("[CHAT] MODO CONTENT EXPLÍCITO - Direto para pipeline multi-agente");
  // Pular toda a detecção automática e ir direto para a seção multi-agente
  // (mover ou duplicar a lógica que está na linha ~1192)
}
```

### Solução Detalhada

**Opção 1 (Recomendada)**: Adicionar guard clause no início do fluxo

```typescript
// Após linha 416 (depois de invalidar queries)

// PRIORIDADE MÁXIMA: Modo explícito de CONTENT sempre usa pipeline unificado
if (explicitMode === "content") {
  console.log("[CHAT] EXPLICIT CONTENT MODE - Using unified pipeline");
  
  // Detectar tipo de conteúdo para o pipeline
  const detectedType = detectContentType(content);
  
  // Ir para a lógica do multi-agente (que começa na linha ~1192)
  // [código do pipeline multi-agente]
  
  return; // Evitar cair em outros fluxos
}

// Resto do fluxo (imagem, URL, free_chat, ideas, etc.)
```

**Opção 2**: Adicionar condição para pular verificação de imagem

Na linha ~422:
```typescript
// Antes:
const shouldGenerateImage = isImageTemplateMode || imageGenRequest.isImageRequest;

// Depois:
const shouldGenerateImage = !explicitMode || explicitMode === "image" 
  ? (isImageTemplateMode || imageGenRequest.isImageRequest)
  : false;
```

E na linha ~799 (free chat):
```typescript
// Antes:
if (isFreeChatModeExplicit) {

// Depois:
if (isFreeChatModeExplicit && explicitMode !== "content") {
```

---

## Resultado Esperado

Após a correção:

**Quando o usuário seleciona modo "Conteúdo" e digita "Gere um conteúdo de LinkedIn para mim":**

1. `pipelineMode = "content"` é passado para `baseSendMessage`
2. `explicitMode === "content"` é detectado no início
3. Fluxo vai DIRETO para `unified-content-api`
4. Conteúdo real é gerado e exibido

**Saída esperada no chat:**
```text
📚 Fontes: Guia de Identidade • 2 itens biblioteca

[Hook de uma linha]

[Parágrafo 1]

[Parágrafo 2]

[CTA]

---
💡 Ideia de imagem:
[Descrição visual]

✓ Validado

👍 Usar │ ✏️ Editar │ ↻ Refazer │ 📌 Salvar
```

---

## Testes Necessários

1. Selecionar modo "Conteúdo" e digitar "Gere um conteúdo de LinkedIn"
2. Verificar que o pipeline `unified-content-api` é chamado
3. Verificar que conteúdo real é exibido (não descrição de imagem)
4. Verificar que `SourcesBadge` mostra as fontes usadas

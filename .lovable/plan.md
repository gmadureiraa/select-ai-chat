
# Correção: Duas Fotrinhas + Texto Cortado no Chat kAI

## Problemas Identificados

### Problema 1: Duas Fotrinhas (Ícones Duplicados)
Analisando a screenshot, o que aparece como "duas fotrinhas" são:
1. **Ícone kAI** (kaleidos-logo) - avatar da mensagem do assistente no `EnhancedMessageBubble`
2. **Ícones de ação** (Copy/Copiar) - do `MessageActions`

Quando o estado `isProcessing=true`, aparece OUTRO ícone (Sparkles no `GlobalKAIChat.tsx` linha 239) mostrando "Pensando...", criando a impressão de ícones duplicados.

**Solução**: Ajustar o layout para que o indicador de processamento não tenha ícone próprio ou compartilhe o mesmo alinhamento visual.

### Problema 2: Texto Cortado Horizontalmente
O CSS foi aplicado na última mudança, mas não está funcionando corretamente porque:
- A classe `overflow-hidden` está no container mas o conteúdo não está respeitando `max-width`
- O `prose` precisa de `word-break: break-word` explícito

### Problema 3: IA Ainda Retornando Checklist
A edge function `kai-simple-chat` tem as instruções corretas (linhas 2160-2169), mas:
- A IA ainda está retornando "Checklist:" e "Observações:"
- As instruções precisam ser ainda mais enfáticas no início do prompt (não apenas no final)

---

## Solução Proposta

### Parte 1: Corrigir Indicador de Processamento

**Arquivo: `src/components/kai-global/GlobalKAIChat.tsx`**

Remover o ícone duplicado do indicador de processamento e alinhar com o layout das mensagens:

```typescript
// Linhas 233-249 - Simplificar o indicador de processamento
{isProcessing && (
  <motion.div
    initial={{ opacity: 0, y: 5 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-start gap-4 py-5"
  >
    {/* Usar o mesmo espaço do avatar mas sem ícone */}
    <div className="flex-shrink-0 w-9 h-9" />
    <SimpleProgress 
      currentStep={currentStep} 
      multiAgentStep={multiAgentStep} 
    />
  </motion.div>
)}
```

Isso alinha o "Pensando..." com o espaço do avatar sem mostrar dois ícones.

### Parte 2: Corrigir Texto Cortado

**Arquivo: `src/components/chat/EnhancedMessageBubble.tsx`**

Ajustar as classes CSS para garantir que o texto quebre corretamente:

```typescript
// Linha 180 - Container principal
<div className="flex flex-col gap-3 max-w-[85%] min-w-0 w-full overflow-hidden">

// Linha 270-276 - Container do texto
<div
  className={cn(
    "relative rounded-2xl px-4 py-3.5 transition-all duration-200",
    "w-full overflow-hidden",
    "break-words [word-break:break-word] [overflow-wrap:anywhere]",
    isUser
      ? "bg-primary/8 border border-primary/15"
      : "bg-muted/30 border border-border/40"
  )}
>

// Linha 291-306 - Prose com overflow fixado
<div className="prose prose-sm dark:prose-invert text-sm leading-relaxed 
  w-full max-w-full
  break-words [word-break:break-word] [overflow-wrap:anywhere]
  [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 
  [&_p]:my-2.5 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5
  ...
">
```

**Arquivo: `src/components/kai-global/GlobalKAIChat.tsx`**

```typescript
// Linha 175 - Container de mensagens
<div className="flex flex-col gap-3 p-4 w-full max-w-full overflow-x-hidden">
```

### Parte 3: Reforçar Proibição de Checklist

**Arquivo: `supabase/functions/kai-simple-chat/index.ts`**

Adicionar instrução de proibição NO INÍCIO do system prompt (não apenas no final):

```typescript
// Linha ~2084 - Adicionar no início do prompt
let systemPrompt = `# REGRAS ABSOLUTAS DE ENTREGA (LEIA PRIMEIRO)

⛔ PROIBIDO INCLUIR NA RESPOSTA:
- "Checklist:", "Observações:", "Notas:", "Dicas:"
- Comentários como "Aqui está...", "Segue...", "Criei para você..."
- Emojis de validação (✅❌)
- Hashtags
- Meta-texto explicando o que você fez

✅ ENTREGUE APENAS: O conteúdo final pronto para publicação.

---

Você é o kAI, um assistente especializado em criação de conteúdo...`;
```

**Arquivo: `supabase/functions/kai-content-agent/index.ts`**

Mesmo reforço no início do prompt.

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/kai-global/GlobalKAIChat.tsx` | Remover ícone duplicado do loading, ajustar overflow |
| `src/components/chat/EnhancedMessageBubble.tsx` | Adicionar word-break e overflow-wrap mais explícitos |
| `supabase/functions/kai-simple-chat/index.ts` | Adicionar proibição no INÍCIO do prompt |
| `supabase/functions/kai-content-agent/index.ts` | Adicionar proibição no INÍCIO do prompt |

---

## Resultado Esperado

### Visual:
- Apenas UM ícone visível durante o processamento (alinhado com mensagens)
- Texto quebrando corretamente sem cortar na horizontal

### Conteúdo:
- IA entregando APENAS o conteúdo final
- Sem seções de "Checklist:" ou "Observações:"

---

## Seção Técnica

### CSS Crítico para Overflow

```css
/* Container da mensagem */
.message-container {
  max-width: 85%;
  min-width: 0;
  width: 100%;
  overflow: hidden;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* Prose content */
.prose {
  width: 100%;
  max-width: 100%;
  word-break: break-word;
  overflow-wrap: anywhere;
}
```

### Posição da Proibição no Prompt

A IA tende a seguir instruções que aparecem **no início** do prompt com mais rigor do que as que aparecem no final (primacy effect). Por isso, as regras de proibição devem vir ANTES da descrição de contexto.

### Deploy Necessário

Após as mudanças, as funções precisam ser redeployadas:
- `kai-simple-chat`
- `kai-content-agent`

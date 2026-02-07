
# Plano: Integração Completa dos Componentes do kAI Chat

## Diagnóstico do Estado Atual

### O que JÁ está funcionando:
1. **Estrutura base do Chat** - `KaiAssistantTab.tsx` renderiza corretamente
2. **Histórico de conversas** - Uma conversa por cliente via `useClientChat`
3. **Envio de mensagens** - Funciona com modos (ideas, content, performance, free_chat)
4. **Componentes criados** - `MessageFeedback`, `SourcesBadge`, `PipelineProgress` existem
5. **Tabela de feedback** - `content_feedback` criada no banco
6. **Edge function** - `unified-content-api` retorna `sources_used`

### O que está FALTANDO integrar:
1. **MessageFeedback** - Botões de aprovação/edição NÃO estão no `EnhancedMessageBubble`
2. **SourcesBadge** - NÃO está sendo exibido nas respostas do assistente
3. **PipelineProgress** - Usa `SimpleProgress` ao invés do novo componente visual
4. **Payload sources_used** - Chat não está recebendo/passando os metadados de fontes
5. **Conexão com unified-content-api** - `useClientChat` pode não estar chamando a API unificada

---

## Alterações Necessárias

### 1. Modificar `EnhancedMessageBubble.tsx`
Adicionar os novos componentes às mensagens do assistente:

```text
┌─────────────────────────────────────────┐
│ 📚 Fontes: Guia, 3 items biblioteca     │  <-- SourcesBadge
├─────────────────────────────────────────┤
│ [Conteúdo da resposta]                  │
│                                         │
│ 👍 Usar  │ ✏️ Editar │ ↻ Refazer │ 📌   │  <-- MessageFeedback
└─────────────────────────────────────────┘
```

Mudanças:
- Importar `MessageFeedback` e `SourcesBadge`
- Renderizar `SourcesBadge` acima do conteúdo quando `payload.sources_used` existir
- Renderizar `MessageFeedback` após o conteúdo para mensagens do assistente
- Passar `messageId`, `clientId`, `formatType` para o feedback

### 2. Atualizar payload do Message
Expandir `MessagePayload` em `types/chat.ts`:

```typescript
export interface MessagePayload {
  citations?: Citation[];
  messageId?: string;
  sources_used?: {
    identity_guide?: boolean;
    library_items_count?: number;
    top_performers_count?: number;
    format_rules?: string;
    voice_profile?: boolean;
  };
  format_type?: string;
  validation?: {
    passed: boolean;
    repaired: boolean;
    reviewed: boolean;
  };
  [key: string]: unknown;
}
```

### 3. Modificar `useClientChat.ts`
Ao receber resposta do chat, extrair e salvar os metadados:

```typescript
// Após receber resposta da edge function
const metadata = response.metadata;
if (metadata) {
  // Salvar mensagem com payload incluindo sources_used
  await supabase.from("messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: response.content,
    payload: {
      sources_used: response.sources_used,
      format_type: metadata.format,
      validation: {
        passed: metadata.validation_passed,
        repaired: metadata.was_repaired,
        reviewed: metadata.reviewed,
      },
    },
  });
}
```

### 4. Substituir `MinimalProgress` por `PipelineProgress`
Em `KaiAssistantTab.tsx`:

```typescript
// Antes
import { MinimalProgress } from "@/components/chat/MinimalProgress";
{isLoading && <MinimalProgress currentStep={currentStep} />}

// Depois  
import { PipelineProgress } from "@/components/chat/PipelineProgress";
{isLoading && (
  <PipelineProgress 
    currentStage={mapStepToStage(multiAgentStep)} 
    showElapsedTime 
  />
)}
```

### 5. Mapear steps para stages do pipeline
Criar função para converter `multiAgentStep` para `PipelineStage`:

```typescript
function mapStepToStage(step: MultiAgentStep): PipelineStage {
  switch (step) {
    case "researcher": return "context";
    case "writer": return "writing";
    case "editor": return "validating";
    case "reviewer": return "reviewing";
    case "complete": return "complete";
    case "error": return "error";
    default: return "idle";
  }
}
```

---

## Arquivos a Modificar

| Arquivo | Ação | Impacto |
|---------|------|---------|
| `src/types/chat.ts` | Expandir `MessagePayload` | Suporte a metadados |
| `src/components/chat/EnhancedMessageBubble.tsx` | Adicionar `SourcesBadge` + `MessageFeedback` | UX completa |
| `src/components/kai/KaiAssistantTab.tsx` | Usar `PipelineProgress` | Progress visual |
| `src/hooks/useClientChat.ts` | Extrair e salvar metadata | Persistência |

---

## Ordem de Implementação

1. **Expandir MessagePayload** - Base para os metadados
2. **Integrar SourcesBadge no EnhancedMessageBubble** - Transparência
3. **Integrar MessageFeedback no EnhancedMessageBubble** - Feedback loop
4. **Substituir MinimalProgress por PipelineProgress** - UX durante geração
5. **Atualizar useClientChat para salvar metadata** - Persistência completa

---

## Resultado Esperado

Após implementação:

```text
┌─────────────────────────────────────────────┐
│ kAI Chat • Cliente X                        │
├─────────────────────────────────────────────┤
│ User: Crie um carrossel sobre produtividade │
├─────────────────────────────────────────────┤
│ ✓ Contexto  ● Escrevendo  ○ Validando  ○ Rev│  <-- PipelineProgress
├─────────────────────────────────────────────┤
│ 📚 Guia de Identidade • 2 itens biblioteca  │  <-- SourcesBadge  
│                                             │
│ **SLIDE 1:** ...                            │
│ **SLIDE 2:** ...                            │
│                                             │
│ ✓ Validado automaticamente                  │  <-- ValidationBadge
│                                             │
│ 👍 Usar │ ✏️ Editar │ ↻ Refazer │ 📌 Salvar │  <-- MessageFeedback
└─────────────────────────────────────────────┘
```

**Histórico**: Cada cliente tem uma conversa única que persiste entre sessões.
**Analytics**: Cada ação (aprovar, editar, regenerar) é registrada na tabela `content_feedback`.

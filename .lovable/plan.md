
# Plano: Limpeza de UI + Correção de Transcrição

## Fase 1: Remover Botões do Chat

### 1.1 Remover QuickActionsSuggestions (Recomendações)
**Arquivo:** `src/components/chat/EnhancedMessageBubble.tsx`

Remover as linhas 336-344:
```typescript
// REMOVER ESTE BLOCO:
{showQuickActions && (
  <QuickActionsSuggestions
    contentType={contentType}
    content={content}
    onAction={(prompt) => onSendMessage(prompt)}
    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
  />
)}
```

### 1.2 Remover SendToCanvasButton (Canvas)
**Arquivo:** `src/components/chat/EnhancedMessageBubble.tsx`

Remover as linhas 359-367:
```typescript
// REMOVER ESTE BLOCO:
{isSubstantialContent && clientId && (
  <SendToCanvasButton
    content={content}
    clientId={clientId}
    clientName={clientName}
    format={contentType !== "general" ? contentType : "post"}
  />
)}
```

### 1.3 Limpar Imports Não Utilizados
Remover:
- `import { SendToCanvasButton } from "./SendToCanvasButton";`
- `import { QuickActionsSuggestions, detectContentType } from "./QuickActionsSuggestions";`

E remover as variáveis não utilizadas:
- `const contentType = ...` (se não for mais usada)
- `const showQuickActions = ...`

---

## Fase 2: Incluir Transcrição no Contexto do kAI

### 2.1 Modificar Query de Posts
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Alterar a query na função `fetchMetricsContext` (linha ~307):

**De:**
```typescript
.select("id, caption, likes, comments, saves, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink")
```

**Para:**
```typescript
.select("id, caption, full_content, video_transcript, likes, comments, saves, shares, reach, impressions, engagement_rate, posted_at, post_type, permalink")
```

### 2.2 Usar Transcrição na Análise
Quando montar o contexto do post para a IA, priorizar `full_content` (que inclui transcrição) sobre `caption`:

```typescript
// Usar full_content se disponível, senão caption
const postContent = p.full_content || p.caption || 'Sem conteúdo';

// Para análise de vídeo/reels, incluir transcrição de áudio
if (p.video_transcript) {
  context += `\n**Transcrição do Áudio:** ${p.video_transcript.substring(0, 500)}...\n`;
}
```

### 2.3 Atualizar Prompt de Análise
Informar a IA que ela tem acesso ao conteúdo completo:

```typescript
// No system prompt, adicionar:
"Você tem acesso ao conteúdo COMPLETO dos posts, incluindo transcrições de imagens e áudio quando disponíveis. Use essas informações para análises mais profundas."
```

---

## Resumo das Mudanças

| Arquivo | Ação |
|---------|------|
| `EnhancedMessageBubble.tsx` | Remover QuickActionsSuggestions e SendToCanvasButton |
| `kai-simple-chat/index.ts` | Adicionar `full_content` e `video_transcript` na query |
| `kai-simple-chat/index.ts` | Usar transcrição no contexto de análise |

---

## Próximos Passos Sugeridos

Após essa implementação, podemos evoluir com:

1. **Persistência de Conversas** - Salvar histórico do chat no banco para retomar depois
2. **Geração de Imagens** - Integrar geração de imagens via prompt no chat
3. **Comparativo entre Períodos** - "Compare dezembro com novembro"
4. **Sugestões Inteligentes** - Após análise, sugerir melhorias baseadas nos dados
5. **Export de Relatórios** - Botão para exportar análise completa em PDF

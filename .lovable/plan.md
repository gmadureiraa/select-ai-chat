
# Plano: Finalizar e Melhorar Integração kAI Chat + Planejamento

## Análise do Estado Atual

### ✅ O que já está implementado:

1. **Edge Function `kai-simple-chat`** (principal):
   - Detecção de intenção de planejamento (`detectPlanningIntent`)
   - Extração de quantidade, plataforma, datas e URLs
   - Função `generatePlanningCards` que cria cards diretamente no banco
   - Prompts para pedir informações faltantes
   - Mensagem de sucesso após criação

2. **Edge Function `kai-planning-executor`**:
   - Função separada para criação de cards (porém NÃO está sendo usada)
   - Duplica lógica que já existe em `kai-simple-chat`

3. **Secrets configurados**:
   - `GOOGLE_AI_STUDIO_API_KEY` ✅
   - `FIRECRAWL_API_KEY` ✅ (para scrape de URLs)
   - Todas as dependências necessárias estão presentes

---

## Problemas Identificados

| Problema | Impacto | Solução |
|----------|---------|---------|
| Edge function `kai-planning-executor` não é usada | Código morto, confusão | Remover ou integrar |
| Falta validação de workspace_id no insert | Pode falhar RLS | Adicionar workspace_id do cliente |
| Campo `content` não é preenchido | Perde conteúdo | Usar `content` além de `description` |
| Não há tratamento para continuar conversa | Usuário precisa repetir tudo | Detectar contexto de conversa anterior |
| Falta log das operações | Difícil debugar | Adicionar logging detalhado |

---

## Correções Necessárias

### 1. Limpar Código Duplicado

A função `kai-planning-executor` duplica lógica que já existe em `kai-simple-chat`. 

**Opção A (Recomendada)**: Remover `kai-planning-executor` pois `kai-simple-chat` já faz tudo internamente.

**Opção B**: Manter como API separada para uso futuro do frontend.

**Decisão**: Manter `kai-planning-executor` mas não usar atualmente (pode ser útil para ações do frontend).

### 2. Corrigir Campo `content` no Insert

O schema de `planning_items` tem campos separados:
- `description` (texto curto)
- `content` (conteúdo completo)

Atualmente só preenche `description`. Corrigir para:

```typescript
// Em generatePlanningCards (linha ~1182-1196)
const { data: newCard, error } = await supabase
  .from("planning_items")
  .insert({
    title: genCard.title,
    description: genCard.title, // Título como resumo
    content: genCard.description, // Conteúdo completo
    client_id: clientId,
    workspace_id: workspaceId,
    column_id: columnId,
    scheduled_at: dates[i] || null,
    platform: intent.platform,
    status: "todo",
    created_by: userId,
  })
```

### 3. Melhorar Detecção de Contexto de Conversa

Quando o usuário responde com informações que faltavam (ex: "Instagram" ou "28/01"), o sistema precisa detectar que é uma continuação.

**Adicionar verificação de histórico**:

```typescript
// Em detectPlanningIntent
function detectPlanningIntentFromContext(
  message: string, 
  history?: HistoryMessage[]
): PlanningIntent {
  // Primeiro verifica se é uma nova intenção de planejamento
  const directIntent = detectPlanningIntent(message);
  if (directIntent.isPlanning) return directIntent;
  
  // Verifica se a última resposta do assistente pediu informações de planejamento
  if (history && history.length > 0) {
    const lastAssistant = history.filter(h => h.role === "assistant").pop();
    if (lastAssistant?.content.includes("Para qual plataforma") ||
        lastAssistant?.content.includes("Para qual data") ||
        lastAssistant?.content.includes("Sobre qual tema")) {
      // Tenta extrair info da resposta do usuário
      return extractPlanningInfoFromAnswer(message, lastAssistant.content);
    }
  }
  
  return { isPlanning: false, /* ... */ };
}
```

### 4. Adicionar Validações de Erro

```typescript
// Validar que workspace_id existe antes de inserir
if (!client.workspace_id) {
  throw new Error("Cliente não está associado a um workspace");
}

// Validar que coluna existe
if (!columnId) {
  throw new Error("Nenhuma coluna de planejamento configurada");
}
```

---

## Melhorias Propostas

### 1. Suporte a Continuação de Conversa

Quando o usuário responde apenas "Instagram" ou "28/01", o sistema deve:
1. Reconhecer que é resposta a uma pergunta anterior
2. Combinar com informações já coletadas
3. Executar a criação

### 2. Melhor Formatação da Resposta de Sucesso

```typescript
function buildPlanningSuccessMessage(cards: any[], intent: PlanningIntent): string {
  const count = cards.length;
  const platformLabel = intent.platform 
    ? ` para **${intent.platform.charAt(0).toUpperCase() + intent.platform.slice(1)}**` 
    : "";
  
  let message = `✅ **${count} ${count === 1 ? "card criado" : "cards criados"}${platformLabel}!**\n\n`;
  
  if (intent.sourceUrl) {
    message += `📎 Baseado em: ${intent.sourceUrl}\n\n`;
  }
  
  message += "📋 **Cards adicionados:**\n\n";
  
  for (let i = 0; i < Math.min(cards.length, 5); i++) {
    const card = cards[i];
    const dateStr = card.scheduled_at 
      ? ` | 📅 ${formatDateBR(card.scheduled_at.split('T')[0])}`
      : "";
    const platform = card.platform 
      ? ` | ${getPlatformEmoji(card.platform)} ${card.platform}`
      : "";
    message += `${i + 1}. **${card.title}**${platform}${dateStr}\n`;
  }
  
  if (cards.length > 5) {
    message += `\n*...e mais ${cards.length - 5} cards*\n`;
  }
  
  message += "\n---\n";
  message += "💡 **Próximos passos:**\n";
  message += "• Acesse **Planejamento** para editar ou reagendar\n";
  message += "• Use drag & drop para reorganizar no calendário\n";
  
  return message;
}

function getPlatformEmoji(platform: string): string {
  const emojis: Record<string, string> = {
    instagram: "📸",
    twitter: "🐦",
    linkedin: "💼",
    youtube: "🎬",
    newsletter: "📧",
    tiktok: "🎵",
  };
  return emojis[platform.toLowerCase()] || "📱";
}
```

### 3. Logging Melhorado

```typescript
console.log("[kai-simple-chat] Creating planning cards:", {
  clientId,
  workspaceId,
  quantity: intent.quantity,
  platform: intent.platform,
  dates,
  hasSourceUrl: !!intent.sourceUrl,
  hasTopic: !!intent.topic,
});

// Após criação
console.log("[kai-simple-chat] Cards created successfully:", {
  count: cards.length,
  cardIds: cards.map(c => c.id),
});
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/kai-simple-chat/index.ts` | Corrigir campo content vs description, melhorar logging, adicionar detecção de contexto |

---

## Ordem de Implementação

1. **Corrigir campo `content` vs `description`** - Bug crítico
2. **Melhorar logging** - Para debug
3. **Adicionar emojis de plataforma** - UX
4. **Implementar detecção de contexto de conversa** - Funcionalidade avançada

---

## Resultado Esperado

Após as correções:

1. ✅ Usuário pede: "Crie 5 tweets para a semana baseado nesse link: [URL]"
2. ✅ kAI Chat extrai conteúdo do link
3. ✅ Gera 5 tweets com IA
4. ✅ Cria 5 cards no planejamento com datas distribuídas (seg-sex)
5. ✅ Mostra resumo formatado com todos os cards criados
6. ✅ Conteúdo salvo no campo `content` (não apenas `description`)

Ou fluxo interativo:

1. ✅ Usuário: "Adiciona um post no planejamento para o Defiverso"
2. ✅ kAI: "Para qual plataforma? Para qual data? Sobre qual tema?"
3. ✅ Usuário: "Instagram, 28/01, sobre produtividade"
4. ✅ kAI: Cria o card e confirma

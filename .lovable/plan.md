

# Plano: Sincronizar e Persistir kAI Chat

## Visão Geral

Dois problemas a resolver:
1. **kAI Chat da Sidebar** usa sistema diferente do Popup
2. **Histórico não persiste** entre sessões

## Solução Recomendada: Remover Chat da Sidebar

A forma mais limpa é **remover o kAI Chat da sidebar** e centralizar toda interação no popup global, que já tem a lógica correta.

---

## Fase 1: Remover kAI Chat da Sidebar

### 1.1 Remover Item do Menu
**Arquivo:** `src/components/kai/KaiSidebar.tsx`

Remover o NavItem "kAI Chat" (linhas 281-306):
```typescript
// REMOVER:
{canAccessKaiChat && (
  <NavItem
    icon={<MessageSquare className="h-4 w-4" />}
    label="kAI Chat"
    active={activeTab === "assistant"}
    onClick={() => onTabChange("assistant")}
    ...
  />
)}
```

### 1.2 Remover Aba "assistant" do Conteúdo
**Arquivo:** `src/components/kai/KaiContent.tsx` (ou similar)

Remover o case para `activeTab === "assistant"` que renderiza `KaiAssistantTab`.

---

## Fase 2: Corrigir Persistência do Histórico

### 2.1 Integrar useKAIConversations no GlobalKAIContext
**Arquivo:** `src/contexts/GlobalKAIContext.tsx`

Adicionar o hook de conversas e conectá-lo ao chat:

```typescript
// Importar
import { useKAIConversations } from "@/hooks/useKAIConversations";

// No Provider:
const {
  conversations,
  activeConversationId,
  setActiveConversationId,
  getOrCreateConversation,
  deleteConversation,
} = useKAIConversations({ clientId: selectedClientId });

// Passar conversationId para o chat:
const simpleChat = useKAISimpleChat({
  clientId: selectedClientId || "",
  conversationId: activeConversationId,  // <-- ADICIONAR
  onConversationCreated: setActiveConversationId,  // <-- ADICIONAR
});
```

### 2.2 Carregar Última Conversa ao Abrir
**Arquivo:** `src/contexts/GlobalKAIContext.tsx`

Quando o painel abrir e houver conversas, selecionar a mais recente:

```typescript
// Quando clientId muda ou ao inicializar:
useEffect(() => {
  if (selectedClientId && conversations.length > 0 && !activeConversationId) {
    // Selecionar conversa mais recente automaticamente
    setActiveConversationId(conversations[0].id);
  }
}, [selectedClientId, conversations, activeConversationId]);
```

### 2.3 Limpar Conversa = Nova Conversa (não apagar dados)
Modificar `clearConversation` para criar nova conversa em vez de limpar:

```typescript
const clearConversation = useCallback(async () => {
  // Em vez de apagar, apenas criar nova conversa
  simpleChat.clearHistory();
  setActiveConversationId(null);
  // Próxima mensagem criará nova conversa automaticamente
}, [simpleChat]);
```

---

## Fase 3: Adicionar Botão "Nova Conversa" no Painel

### 3.1 Atualizar GlobalKAIPanel Header
**Arquivo:** `src/components/kai-global/GlobalKAIPanel.tsx`

Adicionar botão para iniciar nova conversa:

```typescript
// No header, junto com os outros botões:
<Button
  variant="ghost"
  size="icon"
  onClick={onNewConversation}
  title="Nova conversa"
>
  <Plus className="h-4 w-4" />
</Button>
```

### 3.2 Adicionar Dropdown de Histórico (Opcional)
Se quiser permitir navegar entre conversas anteriores:

```typescript
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="icon">
      <History className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {conversations.map((conv) => (
      <DropdownMenuItem 
        key={conv.id}
        onClick={() => onSelectConversation(conv.id)}
      >
        {conv.title}
        <span className="text-muted-foreground text-xs ml-2">
          {formatDate(conv.updated_at)}
        </span>
      </DropdownMenuItem>
    ))}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Fase 4: Apagar Conversa com Confirmação

### 4.1 Manter Lógica Existente
O botão de lixeira no painel já existe. Só precisamos garantir que:
1. Mostra confirmação (AlertDialog)
2. Apaga da tabela `kai_chat_conversations` (cascade deleta mensagens)
3. Cria nova conversa vazia após deletar

```typescript
const handleDeleteConversation = async () => {
  if (!activeConversationId) return;
  
  await deleteConversation(activeConversationId);
  simpleChat.clearHistory();
  setActiveConversationId(null);
  toast.success("Conversa apagada");
};
```

---

## Resumo de Arquivos

| Arquivo | Mudanças |
|---------|----------|
| `src/components/kai/KaiSidebar.tsx` | Remover item "kAI Chat" do menu |
| `src/components/kai/KaiContent.tsx` | Remover renderização de `KaiAssistantTab` |
| `src/contexts/GlobalKAIContext.tsx` | Integrar `useKAIConversations`, passar `conversationId` |
| `src/components/kai-global/GlobalKAIPanel.tsx` | Adicionar botão "Nova conversa" e dropdown de histórico |

---

## Resultado Esperado

1. **Chat centralizado no popup** - Uma única fonte de verdade
2. **Histórico persiste** - Conversas são carregadas do banco ao abrir o painel
3. **Por cliente** - Cada cliente tem suas próprias conversas
4. **Navegação entre conversas** - Pode ver conversas anteriores
5. **Exclusão com confirmação** - Só apaga se usuário confirmar


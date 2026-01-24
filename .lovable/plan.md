
# Plano Completo: Evolução do kAI Chat

## Visão Geral

Implementação de 4 funcionalidades para tornar o kAI Chat mais poderoso e visualmente alinhado com a marca kAI.

---

## Parte 1: Geração de Imagens via IA no Chat

### 1.1 Detecção de Pedido de Imagem
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Adicionar função de detecção (reutilizar padrão de `detectImageGenerationRequest`):
```typescript
function isImageGenerationRequest(message: string): { 
  isRequest: boolean; 
  prompt: string;
} {
  const patterns = [
    /gera(r)?\s*(uma?)?\s*imagem/i,
    /cria(r)?\s*(uma?)?\s*imagem/i,
    /@imagem/i,
    /fazer?\s*(uma?)?\s*(arte|visual|imagem)/i,
  ];
  // Extrair prompt e retornar
}
```

### 1.2 Chamar API de Geração
Quando detectar pedido de imagem, usar a API do Gemini com modalidades `Text` e `Image`:
```typescript
// Usar gemini-2.0-flash-exp-image-generation
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GOOGLE_API_KEY}`,
  {
    method: "POST",
    body: JSON.stringify({
      contents: [{ parts: [{ text: imagePrompt }] }],
      generationConfig: { responseModalities: ["Text", "Image"] },
    }),
  }
);
```

### 1.3 Retornar Imagem no Stream
Modificar o formato de resposta para incluir imagem base64:
```typescript
// Quando for imagem, enviar formato especial:
{
  choices: [{ 
    delta: { 
      content: "Imagem gerada com sucesso!",
      image: "data:image/png;base64,..." 
    } 
  }]
}
```

### 1.4 Exibir Imagem no Chat
**Arquivo:** `src/hooks/useKAISimpleChat.ts`

Modificar processamento para detectar imagens na resposta:
```typescript
const delta = parsed.choices?.[0]?.delta;
if (delta?.image) {
  // Adicionar URL da imagem ao estado
  setMessages(prev => prev.map(m => 
    m.id === assistantId 
      ? { ...m, content: delta.content, imageUrl: delta.image }
      : m
  ));
}
```

### 1.5 Componente de Imagem
**Arquivo:** `src/components/kai-global/GlobalKAIChat.tsx`

Renderizar imagem quando presente:
```tsx
{message.imageUrl && (
  <img 
    src={message.imageUrl} 
    alt="Imagem gerada" 
    className="max-w-full rounded-lg mt-2"
  />
)}
```

---

## Parte 2: Persistência de Conversas

### 2.1 Criar Tabela `kai_chat_conversations`
Não usar a tabela `conversations` existente (usada pelo chat antigo). Criar nova:

```sql
CREATE TABLE kai_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Nova conversa',
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kai_chat_conversations_user ON kai_chat_conversations(user_id);
CREATE INDEX idx_kai_chat_conversations_client ON kai_chat_conversations(client_id);

-- RLS
ALTER TABLE kai_chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own conversations" ON kai_chat_conversations
  FOR ALL USING (auth.uid() = user_id);
```

### 2.2 Criar Tabela `kai_chat_messages`
```sql
CREATE TABLE kai_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES kai_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_kai_chat_messages_conversation ON kai_chat_messages(conversation_id);

-- RLS
ALTER TABLE kai_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON kai_chat_messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM kai_chat_conversations c 
      WHERE c.id = kai_chat_messages.conversation_id 
      AND c.user_id = auth.uid()
    )
  );
```

### 2.3 Modificar Hook `useKAISimpleChat`
**Arquivo:** `src/hooks/useKAISimpleChat.ts`

Adicionar persistência:
```typescript
interface UseKAISimpleChatOptions {
  clientId: string;
  conversationId?: string;
}

// Carregar mensagens ao iniciar
useEffect(() => {
  if (conversationId) {
    loadConversation(conversationId);
  }
}, [conversationId]);

// Salvar mensagem após envio
const saveMessage = async (message: SimpleMessage) => {
  await supabase.from('kai_chat_messages').insert({
    conversation_id: activeConversationId,
    role: message.role,
    content: message.content,
    image_url: message.imageUrl,
  });
};
```

### 2.4 Criar Hook `useKAIConversations`
**Arquivo:** `src/hooks/useKAIConversations.ts`

```typescript
export function useKAIConversations(clientId: string) {
  // Listar conversas do cliente
  const { data: conversations } = useQuery({
    queryKey: ['kai-conversations', clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from('kai_chat_conversations')
        .select('*')
        .eq('client_id', clientId)
        .order('updated_at', { ascending: false });
      return data;
    },
  });

  // Criar nova conversa
  const createConversation = async () => {...};
  
  // Deletar conversa
  const deleteConversation = async (id: string) => {...};
}
```

### 2.5 UI de Histórico
**Arquivo:** `src/components/kai-global/GlobalKAIPanel.tsx`

Adicionar sidebar/dropdown com lista de conversas anteriores.

---

## Parte 3: Comparação de Métricas entre Períodos

### 3.1 Detecção de Comparação
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

Adicionar função:
```typescript
function isComparisonQuery(message: string): {
  isComparison: boolean;
  period1: DateRange | null;
  period2: DateRange | null;
} {
  const patterns = [
    /compare?\s+(\w+)\s+(com|vs?|versus|e|contra)\s+(\w+)/i,
    /diferen[cç]a\s+entre\s+(\w+)\s+e\s+(\w+)/i,
    /(\w+)\s+vs?\s+(\w+)/i,
  ];
  // Extrair os dois períodos mencionados
}
```

### 3.2 Buscar Métricas de Dois Períodos
Modificar `fetchMetricsContext` para aceitar dois períodos:
```typescript
async function fetchComparisonContext(
  supabase: any,
  clientId: string,
  period1: DateRange,
  period2: DateRange
): Promise<string> {
  // Buscar métricas de ambos os períodos
  const [metrics1, metrics2] = await Promise.all([
    fetchPeriodMetrics(supabase, clientId, period1),
    fetchPeriodMetrics(supabase, clientId, period2),
  ]);
  
  // Calcular diferenças
  const comparison = {
    likes: { p1: metrics1.totalLikes, p2: metrics2.totalLikes, diff: ... },
    engagement: { p1: metrics1.avgEngagement, p2: metrics2.avgEngagement, diff: ... },
    reach: { p1: metrics1.totalReach, p2: metrics2.totalReach, diff: ... },
    posts: { p1: metrics1.totalPosts, p2: metrics2.totalPosts, diff: ... },
  };
  
  // Montar contexto formatado
  return `
## Comparativo: ${period1.label} vs ${period2.label}

| Métrica | ${period1.label} | ${period2.label} | Variação |
|---------|------------------|------------------|----------|
| Likes | ${metrics1.totalLikes} | ${metrics2.totalLikes} | ${diff}% |
...
`;
}
```

### 3.3 Prompt Especializado
Adicionar instruções no system prompt quando for comparação:
```typescript
if (isComparison) {
  systemPrompt += `
ANÁLISE COMPARATIVA:
Você está comparando dois períodos. Sua análise deve:
1. Destacar as principais diferenças
2. Identificar tendências (crescimento/queda)
3. Apontar possíveis causas
4. Sugerir ações baseadas nos dados
`;
}
```

---

## Parte 4: Novo Sistema de Cores kAI

### 4.1 Definir Paleta
- **Tema Claro**: Branco (`#FFFFFF`) + Rosa kAI (`#E91E8C` ou similar)
- **Tema Escuro**: Preto (`#0A0A0A`) + Verde kAI (`#00FF7F` ou similar)

### 4.2 Atualizar CSS
**Arquivo:** `src/index.css`

```css
@layer base {
  :root {
    /* kAI Light - Branco e Rosa */
    --background: 0 0% 100%;
    --foreground: 0 0% 9%;
    
    --primary: 330 85% 52%;  /* Rosa kAI */
    --primary-foreground: 0 0% 100%;
    
    --accent: 330 85% 95%;   /* Rosa claro */
    --accent-foreground: 330 85% 25%;
    
    --card: 0 0% 100%;
    --border: 330 20% 90%;
    
    /* Chat */
    --chat-user-bg: 330 85% 95%;
    --chat-user-fg: 330 85% 25%;
    --chat-ai-bg: 0 0% 100%;
    --chat-ai-fg: 0 0% 9%;
    
    /* Charts - Rosa gradiente */
    --chart-1: 330 85% 52%;
    --chart-2: 330 70% 60%;
    --chart-3: 330 55% 70%;
    --chart-4: 330 40% 80%;
    --chart-5: 330 30% 85%;
  }

  .dark {
    /* kAI Dark - Preto e Verde */
    --background: 0 0% 4%;
    --foreground: 0 0% 95%;
    
    --primary: 150 100% 50%;  /* Verde kAI */
    --primary-foreground: 0 0% 0%;
    
    --accent: 150 100% 15%;   /* Verde escuro */
    --accent-foreground: 150 100% 70%;
    
    --card: 0 0% 6%;
    --border: 150 20% 15%;
    
    /* Chat */
    --chat-user-bg: 150 100% 10%;
    --chat-user-fg: 150 100% 70%;
    --chat-ai-bg: 0 0% 6%;
    --chat-ai-fg: 0 0% 95%;
    
    /* Charts - Verde gradiente */
    --chart-1: 150 100% 50%;
    --chart-2: 150 80% 45%;
    --chart-3: 150 60% 40%;
    --chart-4: 150 40% 35%;
    --chart-5: 150 30% 30%;
  }
}
```

### 4.3 Atualizar Tailwind Config
**Arquivo:** `tailwind.config.ts`

Adicionar cores semânticas para kAI:
```typescript
colors: {
  kai: {
    pink: "hsl(330, 85%, 52%)",
    green: "hsl(150, 100%, 50%)",
  },
}
```

### 4.4 Revisar Componentes
Verificar componentes que usam cores hardcoded:
- `GlobalKAIPanel.tsx` - Sidebar e header
- `GlobalKAIChat.tsx` - Bolhas de mensagem
- `SimpleProgress.tsx` - Indicadores de loading
- Gráficos e charts

---

## Resumo de Arquivos

| Arquivo | Mudanças |
|---------|----------|
| `kai-simple-chat/index.ts` | Geração de imagem, comparação de períodos |
| `src/hooks/useKAISimpleChat.ts` | Persistência, suporte a imagens |
| `src/hooks/useKAIConversations.ts` | Novo hook para histórico |
| `src/components/kai-global/GlobalKAIChat.tsx` | Exibir imagens, histórico |
| `src/index.css` | Nova paleta de cores |
| `tailwind.config.ts` | Cores kAI |
| **Migrations** | 2 novas tabelas |

---

## Ordem de Implementação

1. **Cores kAI** (rápido, impacto visual imediato)
2. **Geração de Imagens** (alto valor, diferencial)
3. **Comparação de Períodos** (complementa métricas existentes)
4. **Persistência** (complexo, pode ser incremental)

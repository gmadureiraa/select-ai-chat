
# Plano: Melhorias Avançadas para o kAI

## Visão Geral

Após análise detalhada do código e dados, identifiquei **6 áreas de melhoria** que elevarão significativamente a qualidade do conteúdo gerado e a experiência do usuário.

---

## 1. 📊 Enriquecimento de Contexto com Favoritos

### Problema Atual
O sistema busca exemplos apenas por ordem cronológica (`ORDER BY created_at DESC`). Conteúdos marcados como **favoritos** (campo `is_favorite`) não são priorizados, mesmo sendo os melhores exemplos.

### Solução
Modificar `fetchLibraryExamples` para priorizar favoritos:

```text
PRIORIDADE:
1. Favoritos do mesmo formato (is_favorite = true + content_type match)
2. Favoritos gerais do cliente
3. Mais recentes do formato
4. Fallback genérico
```

### Impacto
Alta qualidade garantida usando os melhores exemplos aprovados pelo usuário.

---

## 2. 🔍 Análise Semântica do Pedido

### Problema Atual
A detecção de formato usa apenas keywords simples. Se o usuário pedir "faça um conteúdo sobre produtividade", o sistema não detecta formato e não carrega exemplos específicos.

### Solução
Adicionar detecção de **intenção implícita**:
- Analisar histórico da conversa para inferir formato
- Perguntar ao usuário quando formato não for claro
- Usar o formato mais usado pelo cliente como default inteligente

```typescript
// Dados atuais mostram que newsletter é o tipo mais comum
// "newsletter": 50, "carousel": 15, "video_script": 15
// Usar como fallback quando não detectar formato
```

---

## 3. 📈 Métricas de Performance nos Exemplos

### Problema Atual
Os exemplos da biblioteca são carregados sem indicação de performance. O sistema não sabe quais exemplos tiveram melhor resultado.

### Solução
Enriquecer exemplos com métricas quando disponíveis:
- Cross-reference com `instagram_posts` para engagement
- Adicionar indicador de performance ao contexto
- Priorizar exemplos com métricas comprovadas

```typescript
// Exemplo de enriquecimento:
"### Exemplo 1: Newsletter Produtividade [⭐ 42% open rate]"
"### Exemplo 2: Carrossel Mindset [📈 8.5% engagement]"
```

---

## 4. 🎯 Sistema de Regras Dinâmicas por Cliente

### Problema Atual
As regras de formato vêm da tabela `kai_documentation` (global). Não existe customização por cliente.

### Solução
Criar sistema de **regras personalizadas**:
1. Manter regras globais como base
2. Permitir override por cliente via novo campo `custom_format_rules` em `clients`
3. Merge inteligente: `global_rules + client_overrides`

---

## 5. 🔄 Feedback Loop para Aprendizado

### Problema Atual
Não há mecanismo para o sistema aprender com feedback. Se o usuário não gosta do conteúdo, essa informação se perde.

### Solução
Implementar **rating de mensagens**:
1. Botões 👍/👎 nas respostas do kAI
2. Salvar feedback na tabela `kai_chat_messages` (novo campo `rating`)
3. Usar mensagens bem avaliadas como exemplos prioritários
4. Evitar padrões de mensagens mal avaliadas

---

## 6. 📝 Completude do Guia de Identidade

### Problema Atual
Dados mostram que apenas 2 de 6 clientes têm `identity_guide` preenchido. Sem isso, a IA cria conteúdo genérico.

### Solução
- Adicionar **prompt de onboarding** quando identity_guide estiver vazio
- Criar template interativo para preenchimento
- Gerar identity_guide automaticamente a partir de exemplos existentes

---

## Ordem de Implementação

| Prioridade | Melhoria | Esforço | Impacto |
|------------|----------|---------|---------|
| 1 | Favoritos primeiro | Baixo | Alto |
| 2 | Métricas nos exemplos | Médio | Alto |
| 3 | Detecção implícita de formato | Médio | Médio |
| 4 | Feedback loop (rating) | Médio | Alto |
| 5 | Regras por cliente | Alto | Médio |
| 6 | Geração de identity guide | Alto | Alto |

---

## Mudanças Técnicas Detalhadas

### Arquivo: `supabase/functions/kai-simple-chat/index.ts`

#### 1. Modificar `fetchLibraryExamples` (Priorizar Favoritos)

```typescript
async function fetchLibraryExamples(
  supabase: any,
  clientId: string,
  contentType: string | null,
  limit: number = 5
): Promise<string> {
  const dbContentType = contentType ? CONTENT_TYPE_MAP[contentType] : null;
  
  // FASE 1: Buscar favoritos do formato específico
  let examples: any[] = [];
  
  if (dbContentType) {
    const { data: favoriteExamples } = await supabase
      .from("client_content_library")
      .select("title, content, content_type, is_favorite, metadata")
      .eq("client_id", clientId)
      .eq("content_type", dbContentType)
      .eq("is_favorite", true)
      .order("created_at", { ascending: false })
      .limit(3);
    
    if (favoriteExamples) examples = favoriteExamples;
  }
  
  // FASE 2: Completar com não-favoritos se necessário
  if (examples.length < limit) {
    const remaining = limit - examples.length;
    const existingIds = examples.map(e => e.id);
    
    let query = supabase
      .from("client_content_library")
      .select("title, content, content_type, is_favorite, metadata")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(remaining);
    
    if (dbContentType) {
      query = query.eq("content_type", dbContentType);
    }
    if (existingIds.length > 0) {
      query = query.not("id", "in", `(${existingIds.join(",")})`);
    }
    
    const { data: moreExamples } = await query;
    if (moreExamples) examples = [...examples, ...moreExamples];
  }
  
  // Formatação com indicador de favorito
  let context = `\n## 📚 Exemplos da Biblioteca de Conteúdo\n`;
  examples.forEach((ex, i) => {
    const favIcon = ex.is_favorite ? "⭐ " : "";
    context += `\n### ${favIcon}Exemplo ${i + 1}: ${ex.title}\n`;
    context += `${ex.content?.substring(0, MAX_LIBRARY_EXAMPLE_LENGTH)}...\n`;
  });
  
  return context;
}
```

#### 2. Adicionar Cross-Reference com Métricas

```typescript
// Após buscar exemplos, enriquecer com métricas do Instagram
async function enrichWithMetrics(
  supabase: any,
  clientId: string,
  examples: any[]
): Promise<any[]> {
  // Buscar posts do Instagram com engagement
  const { data: instaPosts } = await supabase
    .from("instagram_posts")
    .select("caption, engagement_rate, likes")
    .eq("client_id", clientId)
    .order("engagement_rate", { ascending: false })
    .limit(20);
  
  // Match por similaridade de título/conteúdo
  return examples.map(ex => {
    const matchingPost = instaPosts?.find(p => 
      p.caption?.includes(ex.title?.substring(0, 30)) ||
      ex.content?.includes(p.caption?.substring(0, 50))
    );
    
    if (matchingPost) {
      return { 
        ...ex, 
        engagement_rate: matchingPost.engagement_rate,
        likes: matchingPost.likes,
      };
    }
    return ex;
  });
}
```

#### 3. Detecção de Formato Implícito

```typescript
function detectImplicitFormat(
  message: string,
  history: HistoryMessage[]
): string | null {
  // Verificar se formato foi mencionado em mensagens anteriores
  const recentHistory = history?.slice(-5) || [];
  
  for (const msg of recentHistory.reverse()) {
    const content = msg.content.toLowerCase();
    for (const [format, keywords] of Object.entries(contentFormats)) {
      if (keywords.some(k => content.includes(k))) {
        console.log("[kai-simple-chat] Implicit format from history:", format);
        return format;
      }
    }
  }
  
  return null;
}

// Usar na detecção principal:
function detectContentCreation(message: string, history?: HistoryMessage[]) {
  // ... detecção atual ...
  
  // Se não detectou formato explícito, tentar implícito
  if (result.isContentCreation && !result.detectedFormat && history) {
    result.detectedFormat = detectImplicitFormat(message, history);
  }
  
  return result;
}
```

### Arquivo: `src/components/chat/MessageActions.tsx` (ou similar)

#### 4. Adicionar Feedback Rating

```tsx
// Novo componente de rating para mensagens
function MessageRating({ messageId }: { messageId: string }) {
  const [rating, setRating] = useState<number | null>(null);
  
  const handleRating = async (value: number) => {
    await supabase
      .from("kai_chat_messages")
      .update({ rating: value })
      .eq("id", messageId);
    setRating(value);
  };
  
  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="xs" onClick={() => handleRating(1)}>
        👍
      </Button>
      <Button variant="ghost" size="xs" onClick={() => handleRating(-1)}>
        👎
      </Button>
    </div>
  );
}
```

### Migration SQL (para rating)

```sql
ALTER TABLE kai_chat_messages 
ADD COLUMN IF NOT EXISTS rating smallint;

CREATE INDEX idx_kai_messages_rating 
ON kai_chat_messages(conversation_id, rating) 
WHERE rating IS NOT NULL;
```

---

## Resultado Esperado

### Antes
```
Usuário: "Crie um conteúdo sobre produtividade"
Sistema: [não detecta formato, busca exemplos aleatórios, gera conteúdo genérico]
```

### Depois
```
Usuário: "Crie um conteúdo sobre produtividade"

Sistema detecta:
1. Histórico mostra que usuário trabalha com newsletters
2. Busca 3 newsletters ⭐ favoritas + 2 recentes
3. Enriquece com métricas (open rate, engagement)
4. Aplica regras customizadas do cliente
5. Gera conteúdo no estilo aprovado

Usuário avalia: 👍
→ Sistema aprende que esse padrão funciona
```

---

## Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `supabase/functions/kai-simple-chat/index.ts` | Priorizar favoritos, métricas, detecção implícita |
| `src/components/chat/MessageItem.tsx` ou similar | Adicionar botões de rating |
| Migration SQL | Adicionar coluna `rating` |

---

## Próximos Passos

Qual melhoria você gostaria de implementar primeiro?

1. **Favoritos primeiro** - Rápido e alto impacto
2. **Métricas nos exemplos** - Prioriza conteúdo comprovado
3. **Sistema de rating** - Aprendizado contínuo
4. **Detecção implícita** - Experiência mais fluida
5. **Todas** - Implementar sequencialmente

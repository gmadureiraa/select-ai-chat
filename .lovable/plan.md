
# Plano de Expansão de Capacidades do kAI Chat

## Diagnóstico Atual

O kAI Chat Global (`kai-simple-chat`) atualmente:
- Conversa sobre o cliente usando contexto do identity_guide
- Cita materiais das bibliotecas via @menções
- Mantém histórico em memória (15 mensagens)

**NÃO consegue** (mas as funções existem):
- Ver/analisar métricas do cliente
- Gerar relatórios de performance
- Criar cards no planejamento
- Importar métricas de CSV
- Salvar URLs nas referências
- Pesquisar na web
- Gerar imagens

---

## Fase 1: Conectar Análise de Métricas (Prioridade Alta)

### 1.1 Adicionar Detecção de Intenção ao kAI Chat
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

- Antes de chamar a IA, verificar se a mensagem é sobre métricas
- Usar regex patterns existentes em `ACTION_PATTERNS.ask_about_metrics`
- Se detectar métricas → redirecionar para `kai-metrics-agent` internamente

```typescript
// Exemplo de lógica
if (isMetricsQuery(message)) {
  // Buscar métricas e incluir no contexto
  const metrics = await fetchClientMetrics(clientId);
  systemPrompt += buildMetricsContext(metrics);
}
```

### 1.2 Enriquecer Contexto com Métricas Resumidas
- Buscar últimos 30 dias de `platform_metrics`
- Incluir resumo no system prompt automaticamente
- Isso permite que o kAI responda sobre métricas mesmo sem detecção explícita

---

## Fase 2: Adicionar Execução de Ações (Prioridade Alta)

### 2.1 Integrar `useKAIActions` no GlobalKAIContext
**Arquivo:** `src/contexts/GlobalKAIContext.tsx`

- Importar `useKAIActions` e `useKAIExecuteAction`
- Detectar intenção antes de enviar mensagem
- Se ação requer confirmação → mostrar preview
- Se ação é automática → executar e reportar

### 2.2 Ações a Conectar
| Ação | Trigger | Comportamento |
|------|---------|---------------|
| Criar card | "Criar card no planejamento para X" | Mostra preview → confirma → cria |
| Salvar referência | "Adicionar esta URL às referências: [url]" | Extrai conteúdo → confirma → salva |
| Importar métricas | Anexar arquivo CSV | Analisa → preview → confirma → importa |

### 2.3 Adicionar UI de Confirmação
**Arquivo:** `src/components/kai-global/GlobalKAIChat.tsx`

- Quando `pendingAction` existe, mostrar card de preview
- Botões "Confirmar" e "Cancelar"
- Indicador de progresso durante execução

---

## Fase 3: Relatórios de Performance (Prioridade Média)

### 3.1 Adicionar Comando de Relatório
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

- Detectar padrões como "gerar relatório", "análise completa", "report"
- Chamar `generate-performance-insights` internamente
- Retornar resposta formatada em Markdown

### 3.2 UI de Relatório no Chat
**Arquivo:** `src/components/chat/EnhancedMessageBubble.tsx`

- Detectar quando resposta é um relatório (por estrutura/headers)
- Mostrar botão "Exportar PDF" inline
- Styling diferenciado para relatórios

---

## Fase 4: Pesquisa Web (Prioridade Média)

### 4.1 Integrar Grok Search
**Arquivo:** `supabase/functions/kai-simple-chat/index.ts`

- Detectar perguntas que precisam de dados externos
- Patterns: "pesquise sobre", "o que é", "notícias sobre"
- Chamar `grok-search` e incluir resultado no contexto

### 4.2 Citação de Fontes
- Quando usar pesquisa web, incluir links das fontes
- Mostrar chips de citação no chat

---

## Fase 5: Persistência de Conversas (Prioridade Baixa)

### 5.1 Criar Tabela `kai_conversations`
```sql
CREATE TABLE kai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users,
  client_id UUID REFERENCES clients,
  workspace_id UUID REFERENCES workspaces,
  title TEXT,
  messages JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### 5.2 Modificar useKAISimpleChat
- Ao iniciar, verificar se existe conversa ativa
- Ao receber mensagem, salvar no banco
- Botão "Nova conversa" reseta

---

## Resumo de Arquivos a Modificar

| Arquivo | Mudanças |
|---------|----------|
| `kai-simple-chat/index.ts` | Detecção de métricas, integração com metrics-agent |
| `GlobalKAIContext.tsx` | Integrar useKAIActions, gerenciar pendingAction |
| `GlobalKAIChat.tsx` | UI de confirmação de ações, preview de relatórios |
| `GlobalKAIInputMinimal.tsx` | Suporte a anexos de arquivo (CSV) |
| `useKAISimpleChat.ts` | Persistência opcional, detectar ações |

---

## Resultado Esperado

Após implementação, o kAI Chat conseguirá:

1. ✅ Responder perguntas sobre métricas do cliente
2. ✅ Gerar relatórios de performance completos
3. ✅ Criar cards no planejamento via chat
4. ✅ Salvar URLs como referências
5. ✅ Importar métricas de arquivos CSV
6. ✅ Pesquisar informações na web
7. ✅ Manter histórico persistente entre sessões

---

## Ordem de Implementação Sugerida

1. **Fase 1** (essencial) - Métricas no contexto
2. **Fase 2** (alto valor) - Ações executáveis
3. **Fase 3** (diferencial) - Relatórios inline
4. **Fase 4** (nice-to-have) - Pesquisa web
5. **Fase 5** (futuro) - Persistência


# Plano: Sistema de Automações 100% Funcional

## Diagnóstico Atual

Analisando o código existente, identifiquei os seguintes pontos que precisam ser ajustados:

### O que Funciona

| Componente | Status |
|------------|--------|
| AutomationsTab (UI) | Funcional |
| AutomationDialog | Funcional |
| usePlanningAutomations hook | Funcional |
| Edge function process-automations | Parcialmente funcional |
| Tabela planning_automations | Funcional |

### O que Precisa Ser Corrigido

| Problema | Impacto |
|----------|---------|
| `process-automations` não suporta `automationId` para teste manual | Botão "Testar Agora" não funciona |
| `AutomationHistoryDialog` consulta tabela errada | Histórico mostra dados de outra tabela |
| Não há registro de runs das automações de planejamento | Sem histórico de execuções |
| Falta tabela `planning_automation_runs` | Não há onde armazenar o histórico |

---

## Solução

### 1. Criar Tabela de Histórico de Execuções

```sql
CREATE TABLE planning_automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES planning_automations(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  status TEXT NOT NULL DEFAULT 'running',
  result TEXT,
  error TEXT,
  items_created INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  trigger_data JSONB
);

ALTER TABLE planning_automation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view runs from their workspace"
  ON planning_automation_runs FOR SELECT
  USING (is_member_of_workspace(auth.uid(), workspace_id));
```

### 2. Atualizar Edge Function `process-automations`

**Mudanças:**

1. Suportar parâmetro `automationId` para executar uma automação específica (teste manual)
2. Registrar cada execução na nova tabela `planning_automation_runs`
3. Melhorar logging e tratamento de erros

```text
// Fluxo atualizado:

1. Recebe request (com ou sem automationId)
         ↓
2. Se automationId: busca só essa automação
   Senão: busca todas as ativas
         ↓
3. Para cada automação:
   a. Cria registro em planning_automation_runs (status: running)
   b. Executa a lógica do gatilho
   c. Cria card no planejamento
   d. Gera conteúdo (se configurado)
   e. Publica automaticamente (se configurado)
   f. Atualiza planning_automation_runs (status: completed/failed)
```

### 3. Atualizar AutomationHistoryDialog

**Mudança:** Consultar `planning_automation_runs` em vez de `automation_runs`

```typescript
// ANTES (errado):
.from('automation_runs')
.select(`*, automations!automation_runs_automation_id_fkey (name)`)

// DEPOIS (correto):
.from('planning_automation_runs')
.select(`*, planning_automations!planning_automation_runs_automation_id_fkey (name)`)
```

### 4. Adicionar Botão para Testar RSS Feed

Permitir que o usuário teste a URL do RSS antes de salvar a automação.

```text
┌───────────────────────────────────────────────────────────────┐
│  URL do RSS Feed:                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ https://www.youtube.com/feeds/videos.xml?channel_id=... │  │
│  └─────────────────────────────────────────────────────────┘  │
│  [Testar Feed] ← Novo botão                                   │
│                                                               │
│  ✓ Feed válido: 15 itens encontrados                          │
│  Último: "Como criar conteúdo em escala" (há 2 dias)          │
└───────────────────────────────────────────────────────────────┘
```

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `supabase/migrations/...` | Criar | Tabela `planning_automation_runs` |
| `supabase/functions/process-automations/index.ts` | Modificar | Suporte a teste manual + registro de runs |
| `src/components/automations/AutomationHistoryDialog.tsx` | Modificar | Query para tabela correta |
| `src/components/planning/AutomationDialog.tsx` | Modificar | Botão para testar RSS feed |
| `supabase/config.toml` | Modificar | Adicionar verify_jwt = false para fetch-rss-feed |

---

## Detalhes Técnicos

### Edge Function - Suporte a Teste Manual

```typescript
// Recebe body opcional
const body = await req.json().catch(() => ({}));
const { automationId } = body;

// Se automationId fornecido, busca só essa
let query = supabase.from('planning_automations').select('*');

if (automationId) {
  query = query.eq('id', automationId);
} else {
  query = query.eq('is_active', true);
}

const { data: automations } = await query;

// Para teste manual, força execução mesmo se já disparou hoje
if (automationId) {
  // Ignora verificação de last_triggered_at
  shouldTrigger = true;
}
```

### Registro de Runs

```typescript
// Criar run no início
const { data: run } = await supabase
  .from('planning_automation_runs')
  .insert({
    automation_id: automation.id,
    workspace_id: automation.workspace_id,
    status: 'running',
    started_at: new Date().toISOString(),
  })
  .select()
  .single();

// Atualizar no final
await supabase
  .from('planning_automation_runs')
  .update({
    status: error ? 'failed' : 'completed',
    error: error?.message,
    result: `Criado: ${itemTitle}`,
    items_created: 1,
    completed_at: new Date().toISOString(),
    duration_ms: Date.now() - startTime,
  })
  .eq('id', run.id);
```

### Teste de RSS Feed no Dialog

```typescript
const handleTestFeed = async () => {
  setTesting(true);
  try {
    const { data, error } = await supabase.functions.invoke('fetch-rss-feed', {
      body: { rssUrl, limit: 5 }
    });
    
    if (error) throw error;
    
    setFeedResult({
      success: true,
      feedTitle: data.feedTitle,
      itemCount: data.totalItems,
      latestItem: data.items[0],
    });
  } catch (err) {
    setFeedResult({ success: false, error: err.message });
  }
  setTesting(false);
};
```

---

## Resultado Esperado

1. **Teste manual funciona** - Clicar em "Testar Agora" executa a automação imediatamente
2. **Histórico real** - Todas as execuções são registradas e exibidas corretamente
3. **Feedback visual** - Usuário vê status da execução (sucesso/erro/duração)
4. **Validação de RSS** - Usuário pode testar URL antes de salvar
5. **Auto-publish completo** - Integração com Late API para publicação automática

---

## Fluxo Completo Final

```text
1. Usuário cria automação com:
   - Gatilho (RSS/Agenda/Webhook)
   - Perfil e plataforma
   - Geração IA (opcional)
   - Publicação automática (opcional)
         ↓
2. Cron job ou teste manual dispara process-automations
         ↓
3. Registra início em planning_automation_runs
         ↓
4. Verifica gatilho (novo item RSS / horário / webhook)
         ↓
5. Cria card no planejamento
         ↓
6. Se auto_generate_content:
   → Chama kai-content-agent
   → Atualiza card com conteúdo
         ↓
7. Se auto_publish:
   → Busca credenciais Late API
   → Chama late-post
   → Atualiza status para "published"
         ↓
8. Atualiza planning_automation_runs com resultado
         ↓
9. Card aparece no Kanban/Calendário
```


# Plano: Correção de Notificações Push, Publicação Automática e Exibição de Erros

## Problemas Identificados

### 1. Cron Jobs Não Funcionam (Vault vazio)
- Os segredos `project_url` e `cron_service_role_key` **não existem** no Vault do Supabase
- Os cron jobs 7, 8, 9 (process-automations, process-scheduled-posts, process-push-queue) dependem desses segredos
- Resultado: Nenhuma automação, publicação agendada ou push notification é processada automaticamente

### 2. Bug na Verificação de Publicação
- O código em `process-automations` verifica `publishResult.externalId`
- Mas a função `late-post` retorna `postId` (não `externalId`)
- Resultado: Tweets são publicados com sucesso mas marcados como "failed"

### 3. UI Não Exibe Erro de Publicação
- O diálogo de detalhes busca `trigger_data?.publish_error`
- Mas o erro é salvo em `metadata.auto_publish_error` no **planning_item**
- Resultado: Usuário vê "failed" sem explicação

---

## Implementação

### Parte 1: Corrigir Verificação de Sucesso em `process-automations`

Alterar a lógica para aceitar tanto `externalId` quanto `postId`:

```typescript
// Linha ~948: Aceitar ambos os formatos de resposta
const externalPostId = publishResult.externalId || publishResult.postId;
if (publishResult.success && externalPostId) {
  // Publicação confirmada
  await supabase
    .from('planning_items')
    .update({
      status: 'published',
      external_post_id: externalPostId,
      ...
    })
    .eq('id', newItem.id);
}
```

### Parte 2: Salvar Erro de Publicação no `trigger_data` do Run

Atualizar o `planning_automation_runs` com detalhes da publicação para que a UI possa exibir:

```typescript
// Após publicação (sucesso ou falha), atualizar o run com detalhes
const runUpdateData = {
  trigger_data: {
    ...triggerData,
    item_id: newItem.id,
    published: publishResult.success,
    external_post_id: externalPostId || null,
    publish_error: !publishResult.success ? 'Erro na publicação' : null,
    late_response: publishResult,
  }
};

await supabase
  .from('planning_automation_runs')
  .update(runUpdateData)
  .eq('id', runId);
```

### Parte 3: Melhorar Exibição de Erros na UI

Atualizar `AutomationRunDetailDialog.tsx` para buscar erros de múltiplas fontes:

```typescript
// Buscar erro de múltiplas fontes
const publishError = 
  run?.trigger_data?.publish_error || 
  createdItem?.metadata?.auto_publish_error ||
  createdItem?.error_message;

// Exibir se existir
{publishError && (
  <div className="p-4 rounded-lg border border-orange-500/30 bg-orange-500/5">
    <AlertTriangle className="h-5 w-5 text-orange-500" />
    <h4>Erro na Publicação</h4>
    <p>{publishError}</p>
  </div>
)}
```

### Parte 4: Instruções para Criar Segredos no Vault

O usuário precisa executar estes comandos no SQL Editor do Supabase:

```sql
-- Criar segredo com a URL do projeto
SELECT vault.create_secret(
  'https://tkbsjtgrumhvwlxkmojg.supabase.co', 
  'project_url'
);

-- Criar segredo com a Service Role Key
-- (Copiar de Settings > API > service_role key)
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRrYnNqdGdydW1odndseGttb2pnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDM5MTExOSwiZXhwIjoyMDc5OTY3MTE5fQ.XXXXX', 
  'cron_service_role_key'
);
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/process-automations/index.ts` | Corrigir verificação de `postId` vs `externalId`, salvar dados no run |
| `src/components/automations/AutomationRunDetailDialog.tsx` | Buscar erros de múltiplas fontes e exibir corretamente |

---

## Resultado Esperado

1. **Publicações marcadas corretamente** - Aceita `postId` ou `externalId` da Late API
2. **Erros visíveis no histórico** - UI mostra mensagem de erro quando publicação falha
3. **Push notifications funcionando** - Após criar segredos no Vault, cron processa a fila a cada 2 minutos
4. **iPhone recebe notificações** - A subscription já existe, só falta o cron processar

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────┐
│  process-automations (cron 15min)                       │
├─────────────────────────────────────────────────────────┤
│  1. Gera conteúdo via unified-content-api               │
│  2. Chama late-post para publicar                       │
│  3. Verifica publishResult.success && (postId||extId)   │
│  4. Marca status = 'published' ou 'failed'              │
│  5. Atualiza planning_automation_runs com detalhes      │
│  6. Insere em notifications → trigger → push_queue      │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  process-push-queue (cron 2min)                         │
├─────────────────────────────────────────────────────────┤
│  1. Lê fila push_notification_queue                     │
│  2. Busca subscriptions do usuário                      │
│  3. Envia Web Push via VAPID para cada device           │
│  4. Marca como processado                               │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
               📱 iPhone recebe notificação
```

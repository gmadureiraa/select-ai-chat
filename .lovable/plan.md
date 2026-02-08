
# Plano: Notificações no App (incl. PWA/Celular) e Configuração de Cron Jobs

## Análise da Situação Atual

### O que já funciona:
- **Tabela `notifications`** com trigger `trigger_push_notification` que insere automaticamente na fila `push_notification_queue`
- **Edge Function `process-push-queue`** implementada com VAPID e encriptação aes128gcm nativa
- **Assignment notifications**: Trigger em `planning_items` já cria notificação quando `assigned_to` muda
- **Cron jobs 7 e 8 criados** corretamente usando Vault para `process-automations` (15min) e `process-scheduled-posts` (1min)
- **Cron job 5** para `process-push-queue` existe (1min), mas usa `anon_key`

### Problemas Identificados:

1. **Segredos do Vault não existem**: 
   - `project_url` e `cron_service_role_key` não foram criados no Vault
   - Os cron jobs 7 e 8 estão falhando silenciosamente (`url = NULL`)

2. **CHECK constraint desatualizado na tabela `notifications`**:
   - Atual: `'assignment', 'due_date', 'mention', 'publish_reminder'`
   - Faltando: `publish_failed`, `publish_success`, `automation_completed`

3. **`process-automations` não notifica o usuário** quando executa com sucesso

4. **Cron jobs antigos usando anon_key**:
   - Job 5 (`process-push-queue`) usa anon_key hardcoded

---

## Implementação

### Parte 1: Atualizar CHECK Constraint na Tabela `notifications`

Migration SQL para estender os tipos de notificação:

```sql
-- Drop old constraint and create new one with all types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY[
    'assignment'::text, 
    'due_date'::text, 
    'mention'::text, 
    'publish_reminder'::text,
    'publish_failed'::text,
    'publish_success'::text,
    'automation_completed'::text
  ]));
```

### Parte 2: Reconfigurar Cron Jobs para Usar Vault

Atualizar job 5 (`process-push-queue`) para usar Vault:

```sql
-- Remover job antigo
SELECT cron.unschedule('process-push-queue');

-- Criar novo job usando Vault (a cada 2 minutos)
SELECT cron.schedule(
  'process-push-queue-cron',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-push-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Importante**: O usuário precisa criar os segredos no Vault via SQL Editor:

```sql
-- EXECUTAR NO SQL EDITOR DO SUPABASE (não na migration)
-- Substituir pelos valores reais
SELECT vault.create_secret('https://tkbsjtgrumhvwlxkmojg.supabase.co', 'project_url');
SELECT vault.create_secret('SUA_SERVICE_ROLE_KEY_AQUI', 'cron_service_role_key');
```

### Parte 3: Adicionar Notificação em `process-automations`

Após cada execução bem-sucedida de automação, inserir notificação:

```typescript
// Após criar o planning_item e antes do tracking update
if (automation.created_by) {
  await supabase.from('notifications').insert({
    user_id: automation.created_by,
    workspace_id: automation.workspace_id,
    type: 'automation_completed',
    title: `Automação executada: ${automation.name}`,
    message: `Criado: "${itemTitle}"`,
    entity_type: 'planning_automation',
    entity_id: automation.id,
    metadata: {
      planning_item_id: newItem.id,
      trigger_type: automation.trigger_type,
      content_type: automation.content_type,
    }
  });
} else {
  // Fallback: notificar owner do workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', automation.workspace_id)
    .single();
  
  if (workspace?.owner_id) {
    await supabase.from('notifications').insert({
      user_id: workspace.owner_id,
      workspace_id: automation.workspace_id,
      type: 'automation_completed',
      title: `Automação executada: ${automation.name}`,
      message: `Criado: "${itemTitle}"`,
      entity_type: 'planning_automation',
      entity_id: automation.id,
      metadata: {
        planning_item_id: newItem.id,
        trigger_type: automation.trigger_type,
      }
    });
  }
}
```

### Parte 4: Atualizar Frontend

#### 4.1. Atualizar `NotificationType` em `useNotifications.ts`:

```typescript
export type NotificationType = 
  | 'assignment' 
  | 'due_date' 
  | 'mention' 
  | 'publish_reminder' 
  | 'publish_failed'
  | 'publish_success'
  | 'automation_completed';
```

#### 4.2. Atualizar `NotificationBell.tsx`:

Adicionar ícone e cor para `automation_completed`:

```typescript
import { Zap } from 'lucide-react';

const typeIcons: Record<Notification['type'], React.ElementType> = {
  assignment: UserPlus,
  due_date: Calendar,
  mention: MessageSquare,
  publish_reminder: Clock,
  publish_failed: AlertTriangle,
  publish_success: Check,
  automation_completed: Zap,  // Ícone de raio para automações
};

const typeColors: Record<Notification['type'], string> = {
  assignment: 'text-blue-500 bg-blue-500/10',
  due_date: 'text-orange-500 bg-orange-500/10',
  mention: 'text-purple-500 bg-purple-500/10',
  publish_reminder: 'text-green-500 bg-green-500/10',
  publish_failed: 'text-red-500 bg-red-500/10',
  publish_success: 'text-green-500 bg-green-500/10',
  automation_completed: 'text-yellow-500 bg-yellow-500/10',  // Amarelo para automações
};
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| **SQL Migration** | Atualizar CHECK constraint e reconfigurar cron job do push-queue |
| `supabase/functions/process-automations/index.ts` | Inserir notificação após execução bem-sucedida |
| `src/hooks/useNotifications.ts` | Adicionar `automation_completed` ao tipo |
| `src/components/notifications/NotificationBell.tsx` | Adicionar ícone/cor para novo tipo |

---

## Ação Manual Necessária (Vault)

Após a implementação, o usuário deve executar no SQL Editor do Supabase:

```sql
-- Criar segredo para URL do projeto
SELECT vault.create_secret('https://tkbsjtgrumhvwlxkmojg.supabase.co', 'project_url');

-- Criar segredo para Service Role Key (copiar do Dashboard > Settings > API)
SELECT vault.create_secret('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...', 'cron_service_role_key');
```

---

## Fluxo Final

```text
┌─────────────────────────────────────────────────────────────────────┐
│                        EVENTOS QUE GERAM PUSH                       │
├─────────────────────────────────────────────────────────────────────┤
│  1. Assignment (trigger existente em planning_items)                │
│  2. Automation Completed (novo - inserido em process-automations)   │
│  3. Publish Failed/Success (já inserido em process-scheduled-posts) │
│  4. Due Date (process-due-date-notifications)                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  INSERT notifications │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │   TRIGGER AUTOMÁTICO  │
                    │ trigger_push_notification │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  push_notification_queue │
                    └───────────┬───────────┘
                                │
                                ▼ (cron a cada 2 min)
                    ┌───────────────────────┐
                    │   process-push-queue  │
                    │   (Web Push VAPID)    │
                    └───────────┬───────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  📱 PWA / Celular     │
                    │  🖥️ Desktop Browser   │
                    └───────────────────────┘
```

---

## Resultado Esperado

1. **Notificações push funcionando** - Cron job 2min com autenticação correta
2. **Usuário notificado quando automação executa** - Tipo `automation_completed`
3. **Todos os tipos de notificação suportados** - CHECK constraint atualizado
4. **Ícone diferenciado no sino** - Zap amarelo para automações
5. **Clique na notificação navega para o item** - `entity_type: 'planning_automation'`

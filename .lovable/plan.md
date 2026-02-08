
# Diagnóstico: Automação de Twitter não Publicando

## Problemas Identificados

### 1. Cron Job `process-automations` Não Existe

O sistema **não possui** um cron job para disparar automações de agendamento (schedule). O cron `check-rss-triggers-every-5min` chama uma função que **não existe** (`check-rss-triggers`), e mesmo se existisse, não processaria gatilhos de schedule.

**Cron jobs atuais:**
| ID | Nome | O que faz |
|----|------|-----------|
| 1 | daily-instagram-metrics | Métricas às 23:59 |
| 2 | process-scheduled-posts | Publica posts com `scheduled_at` no passado |
| 3 | check-rss-triggers-every-5min | Chama função inexistente |
| 4 | process-recurring-content-daily | Conteúdo recorrente às 6h |
| 5 | process-push-queue | Push notifications |
| 6 | due-date-notifications-9am | Notificações de vencimento |

**Faltando:** Um job que chame `process-automations` para disparar automações com `trigger_type: schedule`.

### 2. Cron Job `process-scheduled-posts` Rejeitando Requisições

Os logs mostram erro contínuo:
```
[process-scheduled-posts] Unauthorized access attempt
```

O cron está usando a `anon_key` ao invés da `service_role_key`. A função exige autenticação de service role, mas o cron usa chave anônima.

### 3. Configuração de Schedule Inconsistente

A automação tem configuração conflitante:
- `type: "daily"` (deveria executar todo dia)
- `days: [1]` (mas só tem segunda-feira selecionada)

Se o código interpreta `days` literalmente, só executa às segundas.

### 4. Posts "Publicados" Sem `external_post_id`

Os 2 últimos posts marcados como `status: published` têm:
- `external_post_id: null` (não foram publicados de verdade no Twitter)
- `metadata.auto_published: true` e `metadata.published_at` preenchidos

Isso sugere que o código marcou como publicado sem confirmar sucesso real da Late API.

---

## Plano de Correção

### Parte 1: Criar Cron Job para `process-automations`

Adicionar no SQL do Supabase (usando Vault para segurança):

```sql
SELECT cron.schedule(
  'process-automations-cron',
  '*/15 * * * *', -- A cada 15 minutos
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-automations',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Parte 2: Corrigir Cron Job `process-scheduled-posts`

Atualizar o job existente para usar Vault:

```sql
-- Remover job antigo
SELECT cron.unschedule('process-scheduled-posts');

-- Criar novo job com autenticação correta
SELECT cron.schedule(
  'process-scheduled-posts-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/process-scheduled-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

### Parte 3: Corrigir Lógica de Schedule no `process-automations`

Atualizar a função `shouldTriggerSchedule()` para tratar `type: daily` corretamente, ignorando o campo `days` quando for diário:

```typescript
function shouldTriggerSchedule(config: ScheduleConfig, lastTriggered: string | null): boolean {
  // Para "daily", ignorar days[] e executar todo dia
  if (config.type === 'daily') {
    if (lastTriggered) {
      const lastDate = new Date(lastTriggered);
      if (lastDate.toDateString() === now.toDateString()) {
        return false; // Já executou hoje
      }
    }
    return config.time ? currentTime >= config.time : true;
  }
  // ... resto do código para weekly/monthly
}
```

### Parte 4: Adicionar Verificação de Sucesso na Publicação

No `process-automations`, verificar se a Late API retornou sucesso antes de marcar como publicado:

```typescript
if (publishResponse.ok) {
  const publishResult = await publishResponse.json();
  
  // Verificar se realmente publicou
  if (publishResult.success && publishResult.externalId) {
    await supabase.from('planning_items').update({
      status: 'published',
      external_post_id: publishResult.externalId,
      // ...
    }).eq('id', newItem.id);
  } else {
    console.error('Late API returned ok but no success:', publishResult);
  }
}
```

### Parte 5: Melhorar Painel de Histórico

Adicionar mais informações no `AutomationHistoryDialog.tsx`:
- Mostrar se houve erro na publicação
- Exibir `external_post_id` quando disponível
- Link direto para o post no Twitter quando publicado

---

## Verificação dos Segredos no Vault

Antes de criar os cron jobs, confirmar que existem:
- `project_url` = `https://tkbsjtgrumhvwlxkmojg.supabase.co`
- `cron_service_role_key` = (service role key do projeto)

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| SQL no Supabase | Criar/atualizar cron jobs |
| `supabase/functions/process-automations/index.ts` | Corrigir lógica de schedule e verificação de publicação |
| `src/components/automations/AutomationHistoryDialog.tsx` | Melhorar exibição de erros e status |

---

## Resultado Esperado

1. **Automações de schedule disparam corretamente** - Cron a cada 15 min
2. **Posts agendados publicam** - Cron a cada minuto com autenticação correta
3. **Tweets realmente vão para o Twitter** - Verificação de sucesso da Late API
4. **Histórico mostra erros claramente** - Usuário pode diagnosticar problemas

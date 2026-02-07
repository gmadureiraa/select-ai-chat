

# Plano: Ativar Sync Automático + Botão Manual de Sincronização de Métricas

## Status Atual

### Edge Function ✅
A função `fetch-late-metrics` já existe e funciona corretamente:
- Busca métricas da API Late para Instagram, Twitter e LinkedIn
- Faz upsert em `instagram_posts`, `twitter_posts`, `linkedin_posts`
- Atualiza `platform_metrics` com dados de seguidores
- Aceita `clientId` opcional no body (para sync de um cliente específico)

### Cron Job ❌
O cron job **NÃO está ativo**. A query `SELECT jobid, jobname FROM cron.job` retornou vazio.

O SQL para criar o cron está documentado em `AUTOMATIONS.md` mas precisa ser executado manualmente no SQL Editor do Supabase.

### Botão de Sync ❌
Não existe nenhum botão no frontend para sincronizar métricas manualmente.

---

## Implementação

### Parte 1: Ativar Cron Job (Requer Ação Manual)

Você precisa executar o seguinte SQL no backend (via Cloud UI > Run SQL):

```sql
-- Habilitar extensões (caso não existam)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- JOB: Buscar métricas do Late (diariamente às 7h UTC = 4h Brasília)
SELECT cron.schedule(
  'fetch-late-metrics-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1) || '/functions/v1/fetch-late-metrics',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_service_role_key' LIMIT 1)
    ),
    body := '{}'::jsonb
  );
  $$
);
```

**Pré-requisitos** (se ainda não configurados):
1. Criar secrets no Vault:
   - `project_url` = `https://tkbsjtgrumhvwlxkmojg.supabase.co`
   - `cron_service_role_key` = Sua SERVICE_ROLE_KEY

### Parte 2: Criar Hook para Sync Manual

Criar um hook reutilizável para chamar a função de sincronização:

**Arquivo:** `src/hooks/useSyncLateMetrics.ts`

```typescript
// Hook que chama fetch-late-metrics para um cliente específico
// Retorna mutation com loading state e funções de invalidação
```

Funcionalidades:
- Aceita `clientId` para sync de um cliente específico
- Invalida as queries de posts após sucesso
- Mostra toast de progresso/sucesso/erro
- Retorna `isSyncing` para UI

### Parte 3: Adicionar Botão de Sync no Performance Tab

Adicionar um botão "Sincronizar" no header do `KaiPerformanceTab.tsx` que:
- Aparece apenas para clientes com Late conectado
- Mostra estado de loading durante sync
- Dispara refresh das métricas após sucesso

**Modificação em:** `src/components/kai/KaiPerformanceTab.tsx`

```typescript
// No header, junto aos tabs de canais:
<Button variant="outline" size="sm" onClick={syncMetrics} disabled={isSyncing}>
  <RefreshCw className={cn("h-4 w-4 mr-2", isSyncing && "animate-spin")} />
  Sincronizar
</Button>
```

### Parte 4: Verificar Late Connection

Criar helper para verificar se o cliente tem Late conectado:

**Modificação em:** `src/hooks/useLateConnection.ts`

Adicionar verificação se o cliente tem `late_profile_id` no metadata das credenciais.

---

## Arquivos a Modificar/Criar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| `src/hooks/useSyncLateMetrics.ts` | Criar | Hook para sincronização manual de métricas |
| `src/components/kai/KaiPerformanceTab.tsx` | Modificar | Adicionar botão de sync no header |

---

## Resultado Esperado

| Funcionalidade | Estado Final |
|----------------|--------------|
| Sync automático diário às 7h UTC | ✅ Ativo (após executar SQL) |
| Botão "Sincronizar" no Performance | ✅ Implementado |
| Feedback visual durante sync | ✅ Loading spinner + toast |
| Refresh automático após sync | ✅ Invalida queries de posts/métricas |

---

## Fluxo Visual

```
┌─────────────────────────────────────────────────────────────┐
│ Performance Tab                                             │
├─────────────────────────────────────────────────────────────┤
│ [Instagram] [YouTube] [Twitter] [LinkedIn] ...   [🔄 Sync] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Cards de métricas, gráficos, tabelas...                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Ao clicar em "Sync":
1. Botão mostra spinner
2. Chama `fetch-late-metrics` com `clientId`
3. Toast: "Sincronizando métricas..."
4. Ao concluir: Toast com resultado (X posts atualizados)
5. Dados na tela são recarregados automaticamente


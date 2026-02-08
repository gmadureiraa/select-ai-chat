# Plano de Revisão Técnica – KAI
## Status: ALTA E MÉDIA PRIORIDADE IMPLEMENTADAS ✅

---

## Resumo da Implementação (Atualizado: Fev 2026)

### ✅ Alta Prioridade (Segurança) - CONCLUÍDO

| # | Tarefa | Status | Detalhes |
|---|--------|--------|----------|
| 1 | Validação de caller em process-push-queue | ✅ DONE | Adicionada validação isCronJob/isServiceRole |
| 2 | Validação de caller em process-email-notifications | ✅ DONE | Adicionada validação isCronJob/isServiceRole |
| 3 | Validação de caller em process-automations | ✅ DONE | Adicionada validação isCronJob/isServiceRole |
| 4 | Validar acesso ao client_id em unified-content-api | ✅ DONE | Extração de auth.uid() do JWT e validação via workspace_members |

### ✅ Média Prioridade (Robustez) - CONCLUÍDO

| # | Tarefa | Status | Detalhes |
|---|--------|--------|----------|
| 5 | Ordenar RSS por pubDate | ✅ DONE | Items ordenados por pubDate decrescente antes de selecionar latestItem |
| 6 | Verificar push_notifications preference no trigger | ✅ DONE | Migration aplicada - trigger verifica notification_preferences->>'push_notifications' |
| 7 | Fallback para owner_id em notificações | ✅ DONE | Lógica created_by > assigned_to > workspace.owner_id |

---

## Baixa Prioridade (Qualidade de Código) - PENDENTE

| # | Tarefa | Esforço | Prioridade |
|---|--------|---------|------------|
| 8 | Delimitar input de usuário nos prompts | 30 min | Baixa |
| 9 | Reduzir uso de `any` em hooks críticos | 2h | Baixa |
| 10 | Refatorar useClientChat em módulos menores | 4h | Baixa |
| 11 | Planejar migração de tabelas legadas | 1h | Baixa |

---

## Detalhes Técnicos da Implementação

### 1. Segurança em Edge Functions de Cron

Padrão implementado em todas as funções:

```typescript
const authHeader = req.headers.get("Authorization");
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const isCronJob = req.headers.get("x-supabase-eed-request") === "true" || 
                  req.headers.get("user-agent")?.includes("Supabase") ||
                  req.headers.get("x-supabase-cron") === "true";
const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

if (!isCronJob && !isServiceRole) {
  return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
}
```

### 2. Autorização em unified-content-api

Validação completa de acesso:

```typescript
// Extrai user do JWT
const { data: claims } = await userSupabase.auth.getUser(userToken);
const userId = claims.user.id;

// Busca workspace do cliente
const { data: clientData } = await supabase
  .from("clients")
  .select("workspace_id")
  .eq("id", client_id)
  .single();

// Verifica se usuário é membro do workspace
const { data: memberData } = await supabase
  .from("workspace_members")
  .select("id")
  .eq("workspace_id", clientData.workspace_id)
  .eq("user_id", userId)
  .single();

if (!memberData) {
  return Response(403, "Forbidden - You don't have access to this client");
}
```

### 3. Ordenação de RSS por pubDate

```typescript
// Ordenar por data (mais recente primeiro)
items.sort((a, b) => {
  if (!a.pubDate || !b.pubDate) return 0;
  return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
});

const latestItem = items[0];
```

### 4. Trigger de Push com Preferências

```sql
-- Verifica preferência antes de enfileirar
SELECT notification_preferences INTO v_prefs FROM profiles WHERE id = NEW.user_id;
v_push_enabled := COALESCE((v_prefs->>'push_notifications')::boolean, true);

IF NOT v_push_enabled THEN
  RETURN NEW; -- Skip push
END IF;
```

### 5. Fallback de Destinatário em Notificações

```typescript
// Lógica de fallback
let notifyUserId = item.created_by || item.assigned_to;

if (!notifyUserId) {
  const { data: workspace } = await supabaseClient
    .from('workspaces')
    .select('owner_id')
    .eq('id', item.workspace_id)
    .single();
  notifyUserId = workspace?.owner_id;
}

if (notifyUserId) {
  // Criar notificação
}
```

---

## Itens NÃO APLICÁVEIS (confirmados na análise)

| Item | Status | Motivo |
|------|--------|--------|
| XSS em dangerouslySetInnerHTML | NÃO SE APLICA | Dados vêm de constantes, não de input |
| kai-simple-chat não usa llm.ts | INCORRETO | Usa API própria intencionalmente (streaming) |
| pgvector no schema public | NÃO CRÍTICO | Funciona normalmente |

---

## Próximos Passos (Baixa Prioridade)

1. **Delimitar input de usuário nos prompts** - Adicionar marcadores `<<<USER_INPUT_START>>>` em kai-simple-chat
2. **Reduzir uso de `any`** - Criar tipos para workflowState, ContentResult, etc.
3. **Refatorar useClientChat** - Dividir em hooks especializados
4. **Tabelas legadas** - Verificar se há escrita ativa, deprecar se não

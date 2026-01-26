
# Correção do kAI Chat - Verificação de Plano

## Problema Identificado

O edge function `kai-simple-chat` falha silenciosamente porque tenta consultar a coluna `subscription_plan` que não existe na tabela `workspaces`. O resultado é que `workspace` retorna `null`, e embora o fluxo continue, pode haver comportamentos inesperados em alguns casos.

A estrutura correta do banco usa:
- `workspace_subscriptions` (vincula workspace a plano)
- `subscription_plans` (define tipo do plano: starter, pro, enterprise)

## Solução

Corrigir a verificação de plano no edge function para usar a estrutura correta do banco de dados.

---

## Arquivo a Modificar

**`supabase/functions/kai-simple-chat/index.ts`**

### Mudança nas linhas 865-881

**De:**
```typescript
// 2. Verify subscription plan
const { data: workspace } = await supabase
  .from("workspaces")
  .select("subscription_plan")
  .eq("id", client.workspace_id)
  .single();

if (workspace) {
  const plan = workspace.subscription_plan?.toLowerCase() || "starter";
  if (!ALLOWED_PLANS.includes(plan)) {
    console.log("[kai-simple-chat] Access denied for plan:", plan);
    return new Response(
      JSON.stringify({ error: "O kAI Chat requer o plano Pro ou superior" }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
```

**Para:**
```typescript
// 2. Verify subscription plan via workspace_subscriptions
const { data: subscription } = await supabase
  .from("workspace_subscriptions")
  .select(`
    status,
    subscription_plans (
      type
    )
  `)
  .eq("workspace_id", client.workspace_id)
  .single();

const planType = (subscription?.subscription_plans as any)?.type?.toLowerCase() || "starter";
console.log("[kai-simple-chat] Plan type:", planType);

if (!ALLOWED_PLANS.includes(planType)) {
  console.log("[kai-simple-chat] Access denied for plan:", planType);
  return new Response(
    JSON.stringify({ error: "O kAI Chat requer o plano Pro ou superior" }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
```

---

## Resumo da Correção

1. Substituir consulta à coluna inexistente `workspaces.subscription_plan`
2. Usar a tabela `workspace_subscriptions` com join em `subscription_plans`
3. Extrair o `type` do plano corretamente
4. Adicionar log para debug do tipo de plano detectado

Esta correção alinha o edge function com a estrutura real do banco de dados e com o padrão usado pelo hook `usePlanFeatures.ts` no frontend.

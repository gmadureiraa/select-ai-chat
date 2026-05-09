import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Crown,
  Loader2,
  ExternalLink,
  Coins,
  Sparkles,
  Zap,
  Building2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TabHeader } from "@/components/kai/TabHeader";
import {
  useSubscription,
  useSubscriptionPlans,
  useWorkspaceTokens,
  useTokenTransactions,
  type PlanType,
  type SubscriptionPlan,
  type TokenTransaction,
} from "@/hooks/useSubscription";
import { apiInvoke } from "@/lib/apiInvoke";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

const PLAN_ICONS: Record<PlanType, React.ComponentType<{ className?: string }>> = {
  free: Sparkles,
  starter: Zap,
  pro: TrendingUp,
  enterprise: Crown,
};

const PLAN_COLORS: Record<PlanType, string> = {
  free: "from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950",
  starter: "from-blue-100 to-blue-50 dark:from-blue-950 dark:to-blue-900",
  pro: "from-violet-100 to-violet-50 dark:from-violet-950 dark:to-violet-900",
  enterprise: "from-amber-100 to-amber-50 dark:from-amber-950 dark:to-amber-900",
};

function formatBRL(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLimit(n: number, suffix: string): string {
  if (n === -1) return "Ilimitado";
  return `${n} ${suffix}`;
}

function txLabel(t: TokenTransaction["type"]): { label: string; color: string } {
  switch (t) {
    case "subscription_credit":
      return { label: "Crédito mensal", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" };
    case "purchase":
      return { label: "Compra", color: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" };
    case "usage":
      return { label: "Uso", color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
    case "refund":
      return { label: "Reembolso", color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
    case "bonus":
      return { label: "Bônus", color: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200" };
    case "adjustment":
      return { label: "Ajuste", color: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200" };
  }
}

// Detecta se Stripe está configurado no ambiente. Se a flag VITE_STRIPE_ENABLED
// estiver explicitamente "false" / "0" / "off", desabilita os botões de assinatura
// e mostra tooltip avisando o admin. Default = enabled (compat com setups que
// não definem a flag explicitamente — backend ainda valida via 503).
const STRIPE_ENABLED = (() => {
  const raw = (import.meta.env.VITE_STRIPE_ENABLED ?? "").toString().toLowerCase().trim();
  if (raw === "false" || raw === "0" || raw === "off" || raw === "no") return false;
  return true;
})();

export function BillingTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { workspace, isOwner, isLoadingWorkspace } = useWorkspace();
  const workspaceId = workspace?.id ?? null;

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: subscription, isLoading: isLoadingSub } = useSubscription(workspaceId);
  const { data: plans, isLoading: isLoadingPlans } = useSubscriptionPlans();
  const { data: tokens, isLoading: isLoadingTokens } = useWorkspaceTokens(workspaceId);
  const { data: transactions, isLoading: isLoadingTx } = useTokenTransactions(workspaceId, 15);

  const currentPlan = subscription?.subscription_plans ?? null;
  const isFreeOrNoSub = !subscription || currentPlan?.type === "free";

  // Detecta retorno do checkout Stripe (success_url=`/?stripe=success`).
  // Tracka uma única vez e limpa a query string pra não re-disparar em remounts.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success") {
      trackEvent(
        isFreeOrNoSub ? "subscription_started" : "subscription_changed",
        {
          workspace_id: workspaceId ?? "unknown",
          plan_type: currentPlan?.type ?? "unknown",
          billing_period: billingPeriod,
        },
      );
      params.delete("stripe");
      params.delete("session_id");
      const qs = params.toString();
      const url = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
      window.history.replaceState({}, "", url);
    }
    // só roda 1x por mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = async (plan: SubscriptionPlan) => {
    if (!workspaceId) return;
    if (!isOwner) {
      toast({
        title: "Apenas o owner pode contratar",
        description: "Peça pro proprietário do workspace gerenciar a assinatura.",
        variant: "destructive",
      });
      return;
    }
    if (plan.type === "free") {
      toast({ title: "Plano Free", description: "Você já tem acesso ao tier gratuito." });
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const { data, error } = await apiInvoke<{ url: string }>("stripe-create-checkout", {
        body: { plan_id: plan.id, billing_period: billingPeriod, workspace_id: workspaceId },
      });
      if (error) {
        toast({
          title: "Não foi possível abrir o checkout",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: "Erro inesperado", description: err.message, variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!workspaceId || !isOwner) return;
    setPortalLoading(true);
    try {
      const { data, error } = await apiInvoke<{ url: string }>("stripe-portal", {
        body: { workspace_id: workspaceId },
      });
      if (error) {
        toast({
          title: "Portal indisponível",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      if (data?.url) window.location.href = data.url;
    } finally {
      setPortalLoading(false);
    }
  };

  if (isLoadingWorkspace) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-muted-foreground" />
              Plano e cobrança
            </CardTitle>
            <CardDescription>
              Apenas o owner do workspace pode visualizar e gerenciar a assinatura.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const tokensBalance = tokens?.balance ?? 0;
  const tokensUsed = tokens?.tokens_used_this_period ?? 0;
  const monthlyAllowance = currentPlan?.tokens_monthly ?? 0;
  const usagePct = monthlyAllowance > 0
    ? Math.min(100, Math.round((tokensUsed / monthlyAllowance) * 100))
    : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <TabHeader
        icon={Crown}
        eyebrow="WORKSPACE · PLANO E COBRANÇA"
        title="Plano e cobrança"
        description="Gerencie a assinatura do workspace, tokens e histórico de transações."
      />

      {/* Card 1 — Subscription atual */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Assinatura atual
              </CardTitle>
              <CardDescription>
                {workspace?.name} {isLoadingSub && "(carregando…)"}
              </CardDescription>
            </div>
            {!isFreeOrNoSub && subscription?.stripe_customer_id && (
              <Button
                onClick={handlePortal}
                disabled={portalLoading}
                variant="outline"
                size="sm"
              >
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Gerenciar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoadingSub ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Plano
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {currentPlan?.name ?? "Free"}
                  </span>
                  {subscription && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        subscription.status === "active" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
                        subscription.status === "past_due" && "bg-amber-100 text-amber-800",
                        subscription.status === "canceled" && "bg-red-100 text-red-800",
                        subscription.status === "trialing" && "bg-blue-100 text-blue-800",
                      )}
                    >
                      {subscription.status}
                    </Badge>
                  )}
                </div>
                {currentPlan && currentPlan.type !== "free" && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatBRL(currentPlan.price_monthly)} / mês
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Próximo ciclo
                </div>
                <div className="text-lg font-semibold">
                  {formatDate(subscription?.current_period_end)}
                </div>
                {subscription?.cancel_at_period_end && (
                  <div className="text-xs text-amber-600 mt-1">
                    Cancelamento agendado
                  </div>
                )}
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                  Tokens
                </div>
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-amber-500" />
                  <span className="text-lg font-semibold">
                    {isLoadingTokens ? "…" : tokensBalance.toLocaleString("pt-BR")}
                  </span>
                  <span className="text-sm text-muted-foreground">disponíveis</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tokensUsed.toLocaleString("pt-BR")} usados no período
                </div>
              </div>
            </div>
          )}

          {monthlyAllowance > 0 && !isLoadingTokens && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Uso mensal</span>
                <span className="font-medium">
                  {tokensUsed.toLocaleString("pt-BR")} / {monthlyAllowance.toLocaleString("pt-BR")} ({usagePct}%)
                </span>
              </div>
              <Progress value={usagePct} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banner Stripe disabled — só aparece quando flag VITE_STRIPE_ENABLED=false */}
      {!STRIPE_ENABLED && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-medium">Stripe não configurado</p>
            <p className="text-xs">
              Cobrança automática está desabilitada nesse ambiente. Os botões de
              assinatura ficam desativados — fale com o admin pra liberar.
            </p>
          </div>
        </div>
      )}

      {/* Card 2 — Planos disponíveis */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Planos disponíveis</CardTitle>
              <CardDescription>
                Escolha o tier que faz sentido pro tamanho da operação.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm", billingPeriod === "monthly" && "font-medium")}>
                Mensal
              </span>
              <Switch
                checked={billingPeriod === "yearly"}
                onCheckedChange={(c) => setBillingPeriod(c ? "yearly" : "monthly")}
              />
              <span className={cn("text-sm", billingPeriod === "yearly" && "font-medium")}>
                Anual
              </span>
              {billingPeriod === "yearly" && (
                <Badge variant="secondary" className="ml-1 bg-emerald-100 text-emerald-800">
                  -25%
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPlans ? (
            <div className="grid gap-4 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-72 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans?.map((plan) => {
                const Icon = PLAN_ICONS[plan.type];
                const isCurrent = currentPlan?.id === plan.id;
                const price = billingPeriod === "monthly" ? plan.price_monthly : plan.price_yearly;
                const monthlyEq = billingPeriod === "yearly" ? Number(plan.price_yearly) / 12 : null;
                const features = plan.features as Record<string, any>;

                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "rounded-lg border p-5 flex flex-col bg-gradient-to-br",
                      PLAN_COLORS[plan.type],
                      isCurrent && "ring-2 ring-primary",
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span className="font-semibold">{plan.name}</span>
                      </div>
                      {isCurrent && (
                        <Badge className="bg-primary text-primary-foreground">Plano atual</Badge>
                      )}
                    </div>

                    <div className="mb-3">
                      <div className="text-3xl font-bold">
                        {Number(price) === 0 ? "Grátis" : formatBRL(price)}
                      </div>
                      {Number(price) > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {billingPeriod === "monthly" ? "por mês" : "por ano"}
                          {monthlyEq && ` (~${formatBRL(monthlyEq)}/mês)`}
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2 text-sm flex-1 mb-4">
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{plan.tokens_monthly.toLocaleString("pt-BR")} tokens / mês</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{formatLimit(plan.max_clients, "clientes")}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                        <span>{formatLimit(plan.max_members, "membros")}</span>
                      </li>
                      {features?.viral_carousel && (
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>Viral Carousel (SV)</span>
                        </li>
                      )}
                      {features?.viral_reels && (
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>Viral Reels</span>
                        </li>
                      )}
                      {features?.viral_radar && (
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span>Viral Radar</span>
                        </li>
                      )}
                      {features?.sla && (
                        <li className="flex items-start gap-2">
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                          <span className="font-medium">SLA dedicado</span>
                        </li>
                      )}
                    </ul>

                    {(() => {
                      const stripeBlocked = !STRIPE_ENABLED && plan.type !== "free";
                      const isDisabled =
                        isCurrent ||
                        checkoutLoading === plan.id ||
                        plan.type === "free" ||
                        stripeBlocked;

                      const button = (
                        <Button
                          className="w-full"
                          variant={isCurrent ? "outline" : "default"}
                          disabled={isDisabled}
                          onClick={() => handleCheckout(plan)}
                          aria-disabled={isDisabled}
                        >
                          {checkoutLoading === plan.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : isCurrent ? (
                            "Plano atual"
                          ) : plan.type === "free" ? (
                            "Tier inicial"
                          ) : currentPlan && currentPlan.type !== "free" ? (
                            "Mudar de plano"
                          ) : (
                            "Assinar"
                          )}
                        </Button>
                      );

                      if (!stripeBlocked) return button;

                      return (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              {/* span wrapper porque botão disabled não dispara hover */}
                              <span tabIndex={0} className="block w-full">
                                {button}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              <p className="text-xs max-w-[220px]">
                                Stripe não configurado — fale com admin.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card 3 — Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de transações</CardTitle>
          <CardDescription>
            Movimentações de tokens nos últimos 15 eventos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTx ? (
            <Skeleton className="h-48 w-full" />
          ) : !transactions?.length ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma transação registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                    <TableHead className="text-right">Saldo após</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => {
                    const meta = txLabel(tx.type);
                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className={meta.color}>
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm",
                            tx.amount > 0 && "text-emerald-600",
                            tx.amount < 0 && "text-red-600",
                          )}
                        >
                          {tx.amount > 0 ? "+" : ""}
                          {tx.amount.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {tx.balance_after.toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                          {tx.description ?? "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

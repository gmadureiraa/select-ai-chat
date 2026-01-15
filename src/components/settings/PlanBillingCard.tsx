import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTokens } from "@/hooks/useTokens";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard, 
  Coins, 
  Infinity, 
  Users, 
  Briefcase, 
  ArrowUpRight,
  Sparkles,
  Settings,
  Loader2
} from "lucide-react";
import { UpgradePlanDialog } from "./UpgradePlanDialog";

export function PlanBillingCard() {
  const { 
    balance, 
    tokensUsedThisPeriod, 
    plan, 
    isLoading, 
    isUnlimited 
  } = useTokens();
  const { isAdminOrOwner } = useWorkspace();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error opening customer portal:", error);
      toast.error("Erro ao abrir portal. Tente novamente.");
    } finally {
      setLoadingPortal(false);
    }
  };

  // Show message for non-admin/owner users
  if (!isAdminOrOwner && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Plano & Créditos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores e proprietários podem visualizar informações de faturamento.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Plano & Créditos</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-8 bg-muted rounded-lg" />
            <div className="h-24 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const planTypeLabels: Record<string, { label: string; color: string }> = {
    free: { label: "Gratuito", color: "bg-muted text-muted-foreground" },
    basic: { label: "Canvas", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    starter: { label: "Canvas", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    canvas: { label: "Canvas", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    agency: { label: "Pro", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    pro: { label: "Pro", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    enterprise: { label: "Enterprise", color: "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400" },
  };

  const planInfo = planTypeLabels[plan?.type || "free"] || planTypeLabels.free;
  
  // Calculate usage percentage
  const tokensMonthly = plan?.tokens_monthly || 1000;
  const usagePercentage = isUnlimited ? 0 : Math.min((tokensUsedThisPeriod / tokensMonthly) * 100, 100);
  const remainingPercentage = isUnlimited ? 100 : Math.max(0, 100 - usagePercentage);

  // Simplified credit display (divide by 1000)
  const formatCredits = (tokens: number) => Math.round(tokens / 1000);
  const creditsAvailable = formatCredits(balance);
  const creditsUsed = formatCredits(tokensUsedThisPeriod);
  const creditsMonthly = formatCredits(tokensMonthly);

  const isLowBalance = !isUnlimited && creditsAvailable < (creditsMonthly * 0.1);
  const isCriticalBalance = !isUnlimited && creditsAvailable < (creditsMonthly * 0.02);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>Plano & Créditos</CardTitle>
            </div>
            <Badge className={planInfo.color}>
              {planInfo.label}
            </Badge>
          </div>
          <CardDescription>
            Gerencie seu plano e acompanhe o uso de créditos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credit Balance */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/20">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isUnlimited ? (
                  <Infinity className="h-4 w-4 text-primary" />
                ) : (
                  <Coins className="h-4 w-4 text-primary" />
                )}
                Créditos Disponíveis
              </div>
              {!isUnlimited && isLowBalance && (
                <Badge variant="destructive" className="text-xs">
                  {isCriticalBalance ? "Crítico" : "Baixo"}
                </Badge>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">
                {isUnlimited ? "∞" : creditsAvailable.toLocaleString("pt-BR")}
              </span>
              <span className="text-sm text-muted-foreground">
                {isUnlimited ? "Ilimitado" : "créditos"}
              </span>
            </div>
          </div>

          {/* Usage Progress */}
          {!isUnlimited && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Créditos usados</span>
                <span className="font-medium">
                  {creditsUsed.toLocaleString("pt-BR")} / {creditsMonthly.toLocaleString("pt-BR")}
                </span>
              </div>
              <Progress 
                value={usagePercentage} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground">
                {remainingPercentage.toFixed(0)}% restante do período
              </p>
            </div>
          )}

          <Separator />

          {/* Plan Limits */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Limite de clientes
              </div>
              <span className="font-medium">
                {plan?.max_clients === 999 ? "Ilimitado" : plan?.max_clients || 3}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Limite de membros
              </div>
              <span className="font-medium">
                {plan?.max_members === 999 ? "Ilimitado" : plan?.max_members || 1}
              </span>
            </div>
          </div>

          {/* Subscription Actions */}
          <Separator />
          <div className="space-y-3">
            {plan?.type !== "enterprise" && plan?.type !== "free" && plan?.hasStripeSubscription && (
              <Button 
                variant="outline"
                className="w-full gap-2" 
                onClick={handleManageSubscription}
                disabled={loadingPortal}
              >
                {loadingPortal ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Settings className="h-4 w-4" />
                )}
                Gerenciar Assinatura
              </Button>
            )}
            {plan?.type !== "enterprise" && (
              <Button 
                className="w-full gap-2" 
                onClick={() => setShowUpgradeDialog(true)}
              >
                <Sparkles className="h-4 w-4" />
                {plan?.type === "free" ? "Fazer Upgrade" : "Fazer Upgrade"}
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            )}
          </div>

          {plan?.type === "enterprise" && (
            <>
              <Separator />
              <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <p className="text-sm text-center text-amber-600 dark:text-amber-400">
                  ✨ Você tem acesso total ao plano Enterprise
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <UpgradePlanDialog 
        open={showUpgradeDialog} 
        onOpenChange={setShowUpgradeDialog}
        currentPlan={plan?.type}
      />
    </>
  );
}

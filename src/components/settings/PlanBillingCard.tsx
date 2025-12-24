import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTokens } from "@/hooks/useTokens";
import { useWorkspace } from "@/hooks/useWorkspace";
import { 
  CreditCard, 
  Coins, 
  Infinity, 
  Users, 
  Briefcase, 
  TrendingUp,
  ArrowUpRight,
  Sparkles
} from "lucide-react";
import { useState } from "react";
import { UpgradePlanDialog } from "./UpgradePlanDialog";

export function PlanBillingCard() {
  const { 
    balance, 
    tokensUsedThisPeriod, 
    plan, 
    isLoading, 
    formattedBalance, 
    isUnlimited 
  } = useTokens();
  const { workspace } = useWorkspace();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

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
    starter: { label: "Starter", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    pro: { label: "Pro", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400" },
    enterprise: { label: "Enterprise", color: "bg-gradient-to-r from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400" },
  };

  const planInfo = planTypeLabels[plan?.type || "free"] || planTypeLabels.free;
  
  // Calculate usage percentage
  const tokensMonthly = plan?.tokens_monthly || 1000;
  const usagePercentage = isUnlimited ? 0 : Math.min((tokensUsedThisPeriod / tokensMonthly) * 100, 100);
  const remainingPercentage = isUnlimited ? 100 : Math.max(0, 100 - usagePercentage);

  const isLowBalance = !isUnlimited && balance < (tokensMonthly * 0.1);
  const isCriticalBalance = !isUnlimited && balance < (tokensMonthly * 0.02);

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
          {/* Token Balance */}
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
                {isUnlimited ? "∞" : formattedBalance}
              </span>
              {!isUnlimited && (
                <span className="text-sm text-muted-foreground">
                  créditos
                </span>
              )}
              {isUnlimited && (
                <span className="text-sm text-muted-foreground">
                  Ilimitado
                </span>
              )}
            </div>
          </div>

          {/* Usage Progress */}
          {!isUnlimited && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uso do período</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("pt-BR").format(tokensUsedThisPeriod)} / {new Intl.NumberFormat("pt-BR").format(tokensMonthly)}
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
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                Créditos mensais
              </div>
              <span className="font-medium">
                {isUnlimited ? "Ilimitados" : new Intl.NumberFormat("pt-BR").format(tokensMonthly)}
              </span>
            </div>
          </div>

          {/* Upgrade Button */}
          {plan?.type !== "enterprise" && (
            <>
              <Separator />
              <div className="space-y-3">
                <Button 
                  className="w-full gap-2" 
                  onClick={() => setShowUpgradeDialog(true)}
                >
                  <Sparkles className="h-4 w-4" />
                  Fazer Upgrade
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  Desbloqueie mais recursos e créditos
                </p>
              </div>
            </>
          )}

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

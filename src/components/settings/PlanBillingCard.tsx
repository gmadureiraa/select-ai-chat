import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useTokens } from "@/hooks/useTokens";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
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
  const isMobile = useIsMobile();
  const { slug } = useParams();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { currentSlug: slug },
      });
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
    basic: { label: "Canvas", color: "bg-accent text-accent-foreground" },
    starter: { label: "Canvas", color: "bg-accent text-accent-foreground" },
    canvas: { label: "Canvas", color: "bg-accent text-accent-foreground" },
    agency: { label: "Pro", color: "bg-primary/10 text-primary" },
    pro: { label: "Pro", color: "bg-primary/10 text-primary" },
    enterprise: { label: "Enterprise", color: "bg-primary/20 text-primary" },
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
              <CardTitle>Plano</CardTitle>
            </div>
            <Badge className={planInfo.color}>
              {planInfo.label}
            </Badge>
          </div>
          <CardDescription>
            Gerencie seu plano e limites
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Credits Display */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Coins className="h-4 w-4" />
                Créditos disponíveis
              </div>
              <span className={`font-medium ${isCriticalBalance ? 'text-destructive' : isLowBalance ? 'text-amber-500' : ''}`}>
                {isUnlimited ? (
                  <span className="flex items-center gap-1">
                    <Infinity className="h-4 w-4" /> Ilimitado
                  </span>
                ) : (
                  `${creditsAvailable} créditos`
                )}
              </span>
            </div>
            
            {!isUnlimited && (
              <div className="space-y-2">
                <Progress 
                  value={remainingPercentage} 
                  className={`h-2 ${isCriticalBalance ? '[&>div]:bg-destructive' : isLowBalance ? '[&>div]:bg-amber-500' : ''}`}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Usado: {creditsUsed} créditos</span>
                  <span>Mensal: {creditsMonthly} créditos</span>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Plan Limits */}
          <div className="grid gap-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Briefcase className="h-4 w-4" />
                Limite de perfis
              </div>
              <span className="font-medium">
                {plan?.max_clients === 999 || !Number.isFinite(plan?.max_clients) || plan?.type === 'enterprise' ? "Ilimitado" : plan?.max_clients || 3}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                Limite de membros
              </div>
              <span className="font-medium">
                {plan?.max_members === 999 || !Number.isFinite(plan?.max_members) || plan?.type === 'enterprise' ? "Ilimitado" : plan?.max_members || 1}
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
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm text-center text-primary">
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

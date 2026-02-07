import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokens } from "@/hooks/useTokens";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CreditCard, 
  Coins, 
  Infinity as InfinityIcon, 
  Users, 
  Briefcase, 
  CheckCircle2
} from "lucide-react";

/**
 * PlanBillingCard - Sistema interno Kaleidos
 * 
 * Versão simplificada sem opções de upgrade/pagamento.
 * Exibe apenas informações do plano interno.
 */
export function PlanBillingCard() {
  const { 
    balance, 
    tokensUsedThisPeriod, 
    isLoading, 
  } = useTokens();
  const { isAdminOrOwner } = useWorkspace();

  // Show message for non-admin/owner users
  if (!isAdminOrOwner && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Plano</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <CreditCard className="h-4 w-4" />
            <AlertDescription>
              Apenas administradores podem visualizar informações do plano.
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
            <CardTitle>Plano</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            <div className="h-16 bg-muted rounded-lg" />
            <div className="h-8 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Simplified credit display (divide by 1000)
  const formatCredits = (tokens: number) => Math.round(tokens / 1000);
  const creditsUsed = formatCredits(tokensUsedThisPeriod);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Plano</CardTitle>
          </div>
          <Badge className="bg-primary/10 text-primary">
            Interno
          </Badge>
        </div>
        <CardDescription>
          Sistema interno Kaleidos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Credits Display */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Coins className="h-4 w-4" />
              Créditos
            </div>
            <span className="font-medium flex items-center gap-1">
              <InfinityIcon className="h-4 w-4" /> Ilimitado
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Uso este período: {creditsUsed} créditos
          </div>
        </div>

        {/* Plan Features */}
        <div className="grid gap-3">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Briefcase className="h-4 w-4" />
              Perfis
            </div>
            <span className="font-medium">Ilimitado</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Membros
            </div>
            <span className="font-medium">Ilimitado</span>
          </div>
        </div>

        {/* Internal Plan Badge */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-sm text-primary">
            <CheckCircle2 className="h-4 w-4" />
            <span>Acesso total ao sistema</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

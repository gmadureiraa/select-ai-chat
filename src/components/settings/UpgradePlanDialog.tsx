import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MessageCircle, Sparkles, Zap, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string;
}

const plans = [
  {
    id: "free",
    name: "Gratuito",
    price: "R$ 0",
    period: "/mês",
    description: "Para experimentar a plataforma",
    features: [
      "1.000 créditos/mês",
      "3 clientes",
      "1 membro",
      "Assistente IA básico",
      "Análise de performance",
    ],
    icon: Zap,
    highlighted: false,
  },
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    description: "Para freelancers e pequenas agências",
    features: [
      "10.000 créditos/mês",
      "10 clientes",
      "3 membros",
      "Assistente IA avançado",
      "Análise de performance",
      "Base de conhecimento",
      "Suporte prioritário",
    ],
    icon: Sparkles,
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    description: "Para agências em crescimento",
    features: [
      "50.000 créditos/mês",
      "Clientes ilimitados",
      "10 membros",
      "Todos os recursos",
      "Geração de imagens IA",
      "Integrações avançadas",
      "Suporte dedicado",
      "API access",
    ],
    icon: Crown,
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes operações",
    features: [
      "Créditos ilimitados",
      "Clientes ilimitados",
      "Membros ilimitados",
      "White-label",
      "SLA garantido",
      "Onboarding dedicado",
      "Suporte 24/7",
      "Custom features",
    ],
    icon: Crown,
    highlighted: false,
  },
];

export function UpgradePlanDialog({ open, onOpenChange, currentPlan }: UpgradePlanDialogProps) {
  const handleContactSales = () => {
    const message = encodeURIComponent(
      "Olá! Tenho interesse em fazer upgrade do meu plano na plataforma Kai. Gostaria de saber mais sobre as opções disponíveis."
    );
    window.open(`https://wa.me/5545999999999?text=${message}`, "_blank");
  };

  const handleSelectPlan = (planId: string) => {
    if (planId === currentPlan) return;
    handleContactSales();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Escolha seu plano
          </DialogTitle>
          <DialogDescription>
            Selecione o plano ideal para suas necessidades. Entre em contato para fazer upgrade.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            
            return (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col p-4 rounded-xl border transition-all",
                  plan.highlighted 
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" 
                    : "border-border bg-card",
                  isCurrent && "ring-2 ring-primary"
                )}
              >
                {plan.highlighted && (
                  <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                    Recomendado
                  </Badge>
                )}
                
                {isCurrent && (
                  <Badge variant="outline" className="absolute -top-2 right-2">
                    Atual
                  </Badge>
                )}

                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={cn(
                      "p-2 rounded-lg",
                      plan.highlighted ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-5 w-5",
                        plan.highlighted ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <h3 className="font-semibold">{plan.name}</h3>
                  </div>
                  
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>

                <ul className="flex-1 space-y-2 mb-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                  disabled={isCurrent}
                  onClick={() => handleSelectPlan(plan.id)}
                >
                  {isCurrent ? "Plano atual" : "Selecionar"}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MessageCircle className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium">Precisa de ajuda para escolher?</h4>
              <p className="text-sm text-muted-foreground">
                Nossa equipe pode ajudar você a encontrar o plano ideal para sua agência.
              </p>
            </div>
            <Button variant="outline" onClick={handleContactSales}>
              Falar com vendas
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

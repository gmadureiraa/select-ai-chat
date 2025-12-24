import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MessageCircle, Sparkles, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpgradePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPlan?: string;
}

const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=12936180547&text=Ol%C3%A1%21+Tenho+interesse+no+plano+Enterprise+do+KAI.&type=phone_number&app_absent=0";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: "R$ 97",
    period: "/mês",
    description: "Para criadores e pequenas equipes",
    features: [
      "10.000 tokens/mês",
      "5 clientes",
      "3 membros",
      "Todos os modelos IA",
      "Performance analytics",
      "Base de conhecimento",
      "Suporte prioritário",
    ],
    icon: Sparkles,
    highlighted: false,
    planType: "starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: "R$ 297",
    period: "/mês",
    description: "Para agências e empresas",
    features: [
      "50.000 tokens/mês",
      "20 clientes",
      "10 membros",
      "Tudo do Starter",
      "Automações ilimitadas",
      "Integrações avançadas",
      "API completa",
      "Gerente dedicado",
    ],
    icon: Crown,
    highlighted: true,
    planType: "pro",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes operações",
    features: [
      "Tokens ilimitados",
      "Clientes ilimitados",
      "Membros ilimitados",
      "Infraestrutura dedicada",
      "SLA garantido",
      "White-label",
      "Suporte 24/7",
      "Features customizadas",
    ],
    icon: Crown,
    highlighted: false,
    planType: "enterprise",
  },
];

export function UpgradePlanDialog({ open, onOpenChange, currentPlan }: UpgradePlanDialogProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleContactSales = () => {
    window.open(WHATSAPP_LINK, "_blank");
  };

  const handleSelectPlan = async (planType: string) => {
    if (planType === currentPlan) return;
    
    if (planType === "enterprise") {
      handleContactSales();
      return;
    }

    setLoading(planType);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { planType },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(null);
    }
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
            Todos os planos incluem 14 dias grátis. Cancele quando quiser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-3 mt-4">
          {plans.map((plan) => {
            const Icon = plan.icon;
            const isCurrent = plan.id === currentPlan;
            const isLoading = loading === plan.planType;
            
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
                    Mais Popular
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
                  disabled={isCurrent || isLoading}
                  onClick={() => handleSelectPlan(plan.planType)}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    "Plano atual"
                  ) : plan.planType === "enterprise" ? (
                    "Falar com vendas"
                  ) : (
                    "Começar 14 dias grátis"
                  )}
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
                Nossa equipe pode ajudar você a encontrar o plano ideal.
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

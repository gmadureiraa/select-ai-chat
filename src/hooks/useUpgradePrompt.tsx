import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Building2, Users, Zap, Crown } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { cn } from "@/lib/utils";

type UpgradeReason = 
  | "max_clients" 
  | "max_members" 
  | "enterprise_feature"
  | "automations"
  | "advanced_analytics"
  | "custom";

interface UpgradePromptContextType {
  showUpgradePrompt: (reason: UpgradeReason, customMessage?: string) => void;
  hideUpgradePrompt: () => void;
}

const UpgradePromptContext = createContext<UpgradePromptContextType | undefined>(undefined);

const UPGRADE_REASONS: Record<UpgradeReason, { 
  title: string; 
  description: string; 
  icon: React.ReactNode;
  targetPlan: "pro" | "enterprise";
}> = {
  max_clients: {
    title: "Limite de Clientes Atingido",
    description: "Você atingiu o limite de clientes do seu plano atual. Faça upgrade para adicionar mais clientes.",
    icon: <Building2 className="h-5 w-5" />,
    targetPlan: "pro",
  },
  max_members: {
    title: "Limite de Membros Atingido",
    description: "Você atingiu o limite de membros da equipe. Faça upgrade para convidar mais pessoas.",
    icon: <Users className="h-5 w-5" />,
    targetPlan: "pro",
  },
  enterprise_feature: {
    title: "Recurso Enterprise",
    description: "Este recurso está disponível apenas no plano Enterprise. Fale com nossa equipe para saber mais.",
    icon: <Crown className="h-5 w-5" />,
    targetPlan: "enterprise",
  },
  automations: {
    title: "Automações Avançadas",
    description: "Desbloqueie automações ilimitadas e recursos avançados com o plano Pro.",
    icon: <Zap className="h-5 w-5" />,
    targetPlan: "pro",
  },
  advanced_analytics: {
    title: "Analytics Avançado",
    description: "Acesse relatórios detalhados e insights avançados com o plano Pro.",
    icon: <Sparkles className="h-5 w-5" />,
    targetPlan: "pro",
  },
  custom: {
    title: "Recurso Premium",
    description: "Este recurso requer um plano superior.",
    icon: <Sparkles className="h-5 w-5" />,
    targetPlan: "pro",
  },
};

export function UpgradePromptProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [isOpen, setIsOpen] = useState(false);
  const [currentReason, setCurrentReason] = useState<UpgradeReason>("custom");
  const [customMessage, setCustomMessage] = useState<string | undefined>();

  const showUpgradePrompt = useCallback((reason: UpgradeReason, message?: string) => {
    setCurrentReason(reason);
    setCustomMessage(message);
    setIsOpen(true);
  }, []);

  const hideUpgradePrompt = useCallback(() => {
    setIsOpen(false);
  }, []);

  const reasonInfo = UPGRADE_REASONS[currentReason];

  const handleUpgrade = () => {
    setIsOpen(false);
    if (reasonInfo.targetPlan === "enterprise") {
      // For enterprise, could open a contact form or external link
      window.open("https://enterprise.lovable.dev/", "_blank");
    } else {
      navigate(`/${slug}/settings?tab=billing`);
    }
  };

  return (
    <UpgradePromptContext.Provider value={{ showUpgradePrompt, hideUpgradePrompt }}>
      {children}
      
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className={cn(
                "p-2.5 rounded-xl",
                reasonInfo.targetPlan === "enterprise" 
                  ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20"
                  : "bg-gradient-to-br from-primary/20 to-secondary/20"
              )}>
                <span className={cn(
                  reasonInfo.targetPlan === "enterprise" ? "text-amber-500" : "text-primary"
                )}>
                  {reasonInfo.icon}
                </span>
              </div>
              <DialogTitle className="text-lg">{reasonInfo.title}</DialogTitle>
            </div>
            <DialogDescription className="text-sm">
              {customMessage || reasonInfo.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Benefits preview */}
            <div className="rounded-lg border border-border/50 bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {reasonInfo.targetPlan === "enterprise" ? "Enterprise inclui" : "Pro inclui"}
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span>{reasonInfo.targetPlan === "enterprise" ? "Clientes ilimitados" : "+5 clientes"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-secondary" />
                  <span>{reasonInfo.targetPlan === "enterprise" ? "Membros ilimitados" : "+10 membros"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="h-4 w-4 text-accent" />
                  <span>Automações ilimitadas</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Agora não
              </Button>
              <Button 
                onClick={handleUpgrade}
                className={cn(
                  "flex-1",
                  reasonInfo.targetPlan === "enterprise"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    : "bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                )}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {reasonInfo.targetPlan === "enterprise" ? "Falar com Vendas" : "Fazer Upgrade"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </UpgradePromptContext.Provider>
  );
}

export function useUpgradePrompt() {
  const context = useContext(UpgradePromptContext);
  if (!context) {
    throw new Error("useUpgradePrompt must be used within UpgradePromptProvider");
  }
  return context;
}

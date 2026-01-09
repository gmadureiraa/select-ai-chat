import { useState, useEffect } from "react";
import { Plus, Loader2, Check, X, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CreateWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = {
  starter: {
    name: "Starter",
    price: "R$ 497,90",
    description: "Ideal para começar",
    features: ["1.000 tokens/mês", "Até 5 clientes", "Suporte por email"],
  },
  pro: {
    name: "Pro",
    price: "R$ 1.497,90",
    description: "Para agências em crescimento",
    features: ["5.000 tokens/mês", "Clientes ilimitados", "Suporte prioritário"],
  },
};

export function CreateWorkspaceDialog({ open, onOpenChange }: CreateWorkspaceDialogProps) {
  const navigate = useNavigate();
  const [workspaceName, setWorkspaceName] = useState("");
  const [slug, setSlug] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"starter" | "pro">("starter");
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Generate slug from workspace name
  useEffect(() => {
    const generatedSlug = workspaceName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setSlug(generatedSlug);
  }, [workspaceName]);

  // Check slug availability
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setIsSlugAvailable(null);
      return;
    }

    const checkSlug = async () => {
      setIsCheckingSlug(true);
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (error) throw error;
        setIsSlugAvailable(!data);
      } catch (error) {
        console.error("Error checking slug:", error);
        setIsSlugAvailable(null);
      } finally {
        setIsCheckingSlug(false);
      }
    };

    const debounce = setTimeout(checkSlug, 500);
    return () => clearTimeout(debounce);
  }, [slug]);

  const handleCreateWorkspace = async () => {
    if (!workspaceName || !slug || !isSlugAvailable) {
      toast.error("Preencha todos os campos corretamente");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          planType: selectedPlan,
          isNewWorkspace: true,
          workspaceName,
          workspaceSlug: slug,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        onOpenChange(false);
        toast.info("Complete o pagamento na nova aba para criar seu workspace");
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast.error("Erro ao iniciar pagamento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setWorkspaceName("");
    setSlug("");
    setSelectedPlan("starter");
    setIsSlugAvailable(null);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) handleReset();
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Criar Novo Workspace
          </DialogTitle>
          <DialogDescription>
            Crie um novo workspace com trial de 14 dias. Você só será cobrado após o período de teste.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {/* Workspace Name */}
          <div className="space-y-2">
            <Label htmlFor="workspace-name">Nome do Workspace</Label>
            <Input
              id="workspace-name"
              placeholder="Minha Agência"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
            />
          </div>

          {/* Slug */}
          <div className="space-y-2">
            <Label htmlFor="workspace-slug">URL do Workspace</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">app.kaleidos.ai/</span>
              <div className="flex-1 relative">
                <Input
                  id="workspace-slug"
                  placeholder="minha-agencia"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  className={cn(
                    "pr-8",
                    isSlugAvailable === true && "border-green-500",
                    isSlugAvailable === false && "border-destructive"
                  )}
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {isCheckingSlug && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingSlug && isSlugAvailable === true && <Check className="h-4 w-4 text-green-500" />}
                  {!isCheckingSlug && isSlugAvailable === false && <X className="h-4 w-4 text-destructive" />}
                </div>
              </div>
            </div>
            {isSlugAvailable === false && (
              <p className="text-xs text-destructive">Esta URL já está em uso</p>
            )}
          </div>

          {/* Plan Selection */}
          <div className="space-y-3">
            <Label>Escolha seu Plano</Label>
            <RadioGroup
              value={selectedPlan}
              onValueChange={(value) => setSelectedPlan(value as "starter" | "pro")}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(PLANS) as Array<keyof typeof PLANS>).map((planKey) => {
                const plan = PLANS[planKey];
                return (
                  <label
                    key={planKey}
                    className={cn(
                      "relative flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all",
                      selectedPlan === planKey
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <RadioGroupItem value={planKey} className="sr-only" />
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{plan.name}</p>
                        <p className="text-xs text-muted-foreground">{plan.description}</p>
                      </div>
                      {selectedPlan === planKey && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-lg font-bold mt-2">{plan.price}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                    <ul className="mt-2 space-y-1">
                      {plan.features.map((feature, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                          <Check className="h-3 w-3 text-primary" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Trial Notice */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <strong className="text-foreground">14 dias grátis!</strong> Você terá acesso completo durante o trial. 
            O pagamento só será processado após esse período.
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleCreateWorkspace}
            disabled={!workspaceName || !slug || !isSlugAvailable || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Criar Workspace
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

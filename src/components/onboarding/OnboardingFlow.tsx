import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Users, AtSign, ChevronRight, ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { OnboardingStep } from "./OnboardingStep";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useClients } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";
import kaleidosLogo from "@/assets/kaleidos-logo.svg";

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { 
    shouldShowOnboarding,
    currentStep, 
    nextStep, 
    prevStep, 
    completeOnboarding,
    skipOnboarding 
  } = useOnboarding();
  
  const [clientName, setClientName] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { createClient } = useClients();
  const { toast } = useToast();

  const handleCreateClient = async () => {
    if (!clientName.trim()) {
      toast({ description: "Digite o nome do cliente", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    try {
      await createClient.mutateAsync({
        name: clientName.trim(),
        description: clientDescription.trim() || null,
        context_notes: null,
      });
      toast({ description: `Cliente "${clientName}" criado com sucesso!` });
      nextStep();
    } catch (error) {
      toast({ description: "Erro ao criar cliente", variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    completeOnboarding();
    onComplete?.();
  };

  const handleSkip = () => {
    skipOnboarding();
    onComplete?.();
  };

  const totalSteps = 3;

  if (!shouldShowOnboarding) {
    return null;
  }

  return (
    <Dialog open={shouldShowOnboarding} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-lg p-0 gap-0 border-border/50 bg-card overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        {/* Header with progress */}
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <img src={kaleidosLogo} alt="kAI" className="h-6 w-6" />
            <span className="font-semibold text-foreground">kAI</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? "w-6 bg-primary"
                      : i < currentStep
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground h-8 px-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8">
          <AnimatePresence mode="wait">
            {currentStep === 0 && (
              <OnboardingStep
                key="welcome"
                icon={<Sparkles className="h-8 w-8 text-primary" />}
                title="Bem-vindo ao kAI"
                description="Sua plataforma de IA para criação de conteúdo. Vamos configurar tudo em menos de 2 minutos."
              >
                <div className="mt-4 space-y-3 text-left">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">1</div>
                    <div>
                      <p className="font-medium text-sm">Criar seu primeiro cliente</p>
                      <p className="text-xs text-muted-foreground">O cliente é o contexto para o conteúdo</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">2</div>
                    <div>
                      <p className="font-medium text-sm">Aprender a usar @menções</p>
                      <p className="text-xs text-muted-foreground">Como direcionar a IA para formatos específicos</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">3</div>
                    <div>
                      <p className="font-medium text-sm">Começar a criar</p>
                      <p className="text-xs text-muted-foreground">Gerar seu primeiro conteúdo</p>
                    </div>
                  </div>
                </div>
              </OnboardingStep>
            )}

            {currentStep === 1 && (
              <OnboardingStep
                key="client"
                icon={<Users className="h-8 w-8 text-primary" />}
                title="Crie seu primeiro cliente"
                description="O cliente é a marca ou pessoa para quem você vai criar conteúdo. A IA usa essas informações para manter consistência."
              >
                <div className="mt-4 space-y-4 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="client-name">Nome do cliente *</Label>
                    <Input
                      id="client-name"
                      placeholder="Ex: Minha Marca, João Silva..."
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client-desc">Descrição (opcional)</Label>
                    <Textarea
                      id="client-desc"
                      placeholder="Breve descrição do cliente, área de atuação..."
                      value={clientDescription}
                      onChange={(e) => setClientDescription(e.target.value)}
                      className="bg-background resize-none"
                      rows={2}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Você pode editar e adicionar mais detalhes depois em Configurações do Cliente.
                  </p>
                </div>
              </OnboardingStep>
            )}

            {currentStep === 2 && (
              <OnboardingStep
                key="mentions"
                icon={<AtSign className="h-8 w-8 text-primary" />}
                title="Use @ para formatos"
                description="Digite @ no chat para ver os formatos disponíveis. Isso diz à IA exatamente que tipo de conteúdo criar."
              >
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-xl bg-muted/50 border border-border/50">
                    <p className="text-sm font-medium mb-3">Exemplos de uso:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs">@carrossel</span>
                        <span className="text-muted-foreground">→ Gera carrossel de 10 slides</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs">@newsletter</span>
                        <span className="text-muted-foreground">→ Gera newsletter completa</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-mono text-xs">@reels</span>
                        <span className="text-muted-foreground">→ Gera roteiro de reels</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Você pode combinar formatos: "@carrossel sobre produtividade"
                  </p>
                </div>
              </OnboardingStep>
            )}
          </AnimatePresence>
        </div>

        {/* Footer with navigation */}
        <div className="flex items-center justify-between px-6 pb-6">
          <Button
            variant="ghost"
            onClick={prevStep}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </Button>
          
          {currentStep === 1 ? (
            <Button onClick={handleCreateClient} disabled={isCreating || !clientName.trim()}>
              {isCreating ? "Criando..." : "Criar e Continuar"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : currentStep === totalSteps - 1 ? (
            <Button onClick={handleComplete}>
              Começar a Usar
              <Sparkles className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={nextStep}>
              Continuar
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

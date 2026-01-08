import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Image,
  MessageSquare,
  Zap,
  BarChart3,
  CheckCircle,
  ChevronRight,
  ChevronLeft,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface KAITutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const TUTORIAL_STEPS = [
  {
    id: "welcome",
    title: "Bem-vindo ao kAI! 🎉",
    description:
      "Seu assistente de conteúdo com inteligência artificial. Vou te mostrar algumas funcionalidades incríveis em poucos passos.",
    icon: MessageSquare,
    color: "text-primary",
    examples: [],
  },
  {
    id: "images",
    title: "Geração de Imagens",
    description:
      "Peça imagens naturalmente e o kAI ajusta automaticamente o formato para cada plataforma.",
    icon: Image,
    color: "text-pink-500",
    examples: [
      "Gera uma imagem para o Instagram",
      "@imagem de capa para YouTube",
      "Cria um visual para stories",
    ],
  },
  {
    id: "context",
    title: "Referências Contextuais",
    description:
      "O kAI entende o contexto da conversa. Use referências naturais para continuar ou refinar conteúdos.",
    icon: Zap,
    color: "text-amber-500",
    examples: [
      '"Isso ficou ótimo, desenvolva mais"',
      '"A terceira opção, mas mais curta"',
      '"Continua esse raciocínio"',
    ],
  },
  {
    id: "metrics",
    title: "Análise de Métricas",
    description:
      "Pergunte sobre performance e o kAI analisa seus dados para dar insights acionáveis.",
    icon: BarChart3,
    color: "text-green-500",
    examples: [
      "Como está meu Instagram?",
      "Quais foram os melhores posts da semana?",
      "Analisa a performance dos últimos 30 dias",
    ],
  },
  {
    id: "complete",
    title: "Pronto para começar! 🚀",
    description:
      "Agora você conhece as principais funcionalidades. Experimente conversar naturalmente - o kAI se adapta ao seu estilo.",
    icon: CheckCircle,
    color: "text-primary",
    examples: [],
  },
];

export const KAITutorial = ({ isOpen, onClose, onComplete }: KAITutorialProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < TUTORIAL_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0"
            onClick={handleSkip}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {currentStep + 1} de {TUTORIAL_STEPS.length}
            </span>
          </div>
          <Progress value={progress} className="h-1 mt-2" />
        </DialogHeader>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="py-6"
          >
            <div className="flex flex-col items-center text-center">
              <div
                className={cn(
                  "p-4 rounded-full mb-4",
                  step.color,
                  "bg-current/10"
                )}
              >
                <Icon className={cn("h-8 w-8", step.color)} />
              </div>

              <DialogTitle className="text-xl mb-2">{step.title}</DialogTitle>
              <p className="text-muted-foreground mb-6">{step.description}</p>

              {step.examples.length > 0 && (
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Exemplos
                  </p>
                  {step.examples.map((example, i) => (
                    <div
                      key={i}
                      className="bg-muted/50 rounded-lg px-4 py-2 text-sm text-left"
                    >
                      {example}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>

          <Button onClick={handleNext} className="gap-1">
            {currentStep === TUTORIAL_STEPS.length - 1 ? (
              "Começar"
            ) : (
              <>
                Próximo
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

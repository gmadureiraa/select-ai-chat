import { useState } from "react";
import { 
  Target,
  Award,
  Zap,
  BookOpen,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

interface BriefingQuestion {
  id: number;
  question: string;
  placeholder: string;
  icon: React.ComponentType<any>;
  color: string;
}

// As 4 perguntas estratégicas (de trás para frente)
const BRIEFING_QUESTIONS: BriefingQuestion[] = [
  {
    id: 1,
    question: "Qual resultado eu quero alcançar?",
    placeholder: "Ex: Ser referência em marketing digital para pequenas empresas",
    icon: Target,
    color: "bg-red-500/10 text-red-600 border-red-200",
  },
  {
    id: 2,
    question: "Pelo que eu precisaria ser conhecido para isso acontecer?",
    placeholder: "Ex: Especialista em estratégias práticas e acessíveis de marketing",
    icon: Award,
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
  {
    id: 3,
    question: "O que eu precisaria fazer para ser conhecido por isso?",
    placeholder: "Ex: Compartilhar cases reais, tutoriais práticos, bastidores do meu trabalho",
    icon: Zap,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200",
  },
  {
    id: 4,
    question: "O que eu preciso aprender para conseguir fazer essas coisas?",
    placeholder: "Ex: Técnicas de storytelling, edição de vídeo, análise de métricas",
    icon: BookOpen,
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
];

interface BriefingTemplatesProps {
  onSelect: (briefing: string) => void;
  disabled?: boolean;
  clientName?: string;
}

export function BriefingTemplates({ onSelect, disabled, clientName }: BriefingTemplatesProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [answers, setAnswers] = useState<Record<number, string>>({
    1: "",
    2: "",
    3: "",
    4: "",
  });

  const handleAnswerChange = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleGenerateBriefing = () => {
    // Montar o briefing com base nas respostas
    const briefingParts: string[] = [];
    
    if (answers[1]) {
      briefingParts.push(`🎯 RESULTADO DESEJADO: ${answers[1]}`);
    }
    if (answers[2]) {
      briefingParts.push(`🏆 POSICIONAMENTO: Ser conhecido como ${answers[2]}`);
    }
    if (answers[3]) {
      briefingParts.push(`⚡ AÇÕES DE CONTEÚDO: ${answers[3]}`);
    }
    if (answers[4]) {
      briefingParts.push(`📚 TEMAS A EXPLORAR: ${answers[4]}`);
    }

    if (briefingParts.length === 0) {
      return;
    }

    const fullBriefing = `Com base no perfil ${clientName ? `de ${clientName}` : 'do cliente'}, criar conteúdos estratégicos seguindo este framework:\n\n${briefingParts.join('\n\n')}\n\nOs conteúdos devem filtrar temas que realmente constroem audiência qualificada e evitam dispersão de foco.`;
    
    onSelect(fullBriefing);
  };

  const hasAnyAnswer = Object.values(answers).some(a => a.trim() !== "");
  const allAnswersFilled = Object.values(answers).every(a => a.trim() !== "");

  return (
    <div className="space-y-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-lg border border-border",
          "hover:border-primary/50 hover:bg-muted/30 transition-all",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">Framework de Conteúdo</p>
            <p className="text-xs text-muted-foreground">4 perguntas para filtrar seus temas</p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-4">
            <div className="text-center pb-2">
              <p className="text-sm font-medium text-foreground">
                São 4 perguntas, de trás para frente:
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Isso filtra os temas que você vai abordar e <strong>evita que você construa uma audiência que não leva a lugar nenhum.</strong>
              </p>
            </div>

            <div className="space-y-3">
              {BRIEFING_QUESTIONS.map((q) => {
                const Icon = q.icon;
                return (
                  <div key={q.id} className="space-y-2">
                    <div className="flex items-start gap-2">
                      <div className={cn(
                        "h-6 w-6 rounded-md flex items-center justify-center shrink-0 text-xs font-bold border",
                        q.color
                      )}>
                        {q.id}
                      </div>
                      <Label className="text-sm font-medium leading-tight">
                        {q.question}
                      </Label>
                    </div>
                    <Textarea
                      value={answers[q.id]}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder={q.placeholder}
                      rows={2}
                      disabled={disabled}
                      className="text-sm resize-none"
                    />
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleGenerateBriefing}
              disabled={disabled || !hasAnyAnswer}
              className="w-full gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Gerar Briefing Estratégico
              <ArrowRight className="h-4 w-4" />
            </Button>

            {!allAnswersFilled && hasAnyAnswer && (
              <p className="text-xs text-muted-foreground text-center">
                💡 Quanto mais perguntas responder, mais focado será o conteúdo
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

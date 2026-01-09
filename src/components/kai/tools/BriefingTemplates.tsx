import { 
  Rocket, 
  GraduationCap, 
  Star, 
  MessageCircle,
  TrendingUp,
  Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BriefingTemplate {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  color: string;
  briefing: string;
}

const BRIEFING_TEMPLATES: BriefingTemplate[] = [
  {
    id: "lancamento",
    name: "Lançamento",
    icon: Rocket,
    color: "text-orange-500",
    briefing: "Criar conteúdos para lançamento de produto/serviço. Destacar benefícios principais, criar urgência e incluir CTA forte para conversão.",
  },
  {
    id: "educacional",
    name: "Educativo",
    icon: GraduationCap,
    color: "text-blue-500",
    briefing: "Criar conteúdos educativos com dicas práticas e valor real para a audiência. Foco em resolver problemas e ensinar conceitos de forma simples.",
  },
  {
    id: "cases",
    name: "Cases",
    icon: Star,
    color: "text-yellow-500",
    briefing: "Criar conteúdos destacando resultados e depoimentos de clientes. Foco em transformação, números concretos e prova social.",
  },
  {
    id: "engajamento",
    name: "Engajamento",
    icon: MessageCircle,
    color: "text-green-500",
    briefing: "Criar conteúdos para gerar engajamento e interação: enquetes, perguntas provocativas, debates e conexão com a audiência.",
  },
  {
    id: "autoridade",
    name: "Autoridade",
    icon: TrendingUp,
    color: "text-purple-500",
    briefing: "Criar conteúdos que posicionem como autoridade no mercado. Compartilhar insights exclusivos, tendências e análises profundas.",
  },
  {
    id: "conexao",
    name: "Conexão",
    icon: Heart,
    color: "text-pink-500",
    briefing: "Criar conteúdos para humanizar a marca e criar conexão emocional. Bastidores, histórias pessoais e valores da marca.",
  },
];

interface BriefingTemplatesProps {
  onSelect: (briefing: string) => void;
  disabled?: boolean;
}

export function BriefingTemplates({ onSelect, disabled }: BriefingTemplatesProps) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">💡 Templates rápidos</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {BRIEFING_TEMPLATES.map((template) => {
          const Icon = template.icon;
          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.briefing)}
              disabled={disabled}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border",
                "hover:border-primary/50 hover:bg-muted/50 transition-all",
                "text-center group",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              <Icon className={cn("h-5 w-5", template.color, "group-hover:scale-110 transition-transform")} />
              <span className="text-xs font-medium">{template.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

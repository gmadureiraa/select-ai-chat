import { Button } from "@/components/ui/button";
import { FileText, Mail, Image, Video, TrendingUp, Newspaper, Sparkles, MessageCircle, Lightbulb } from "lucide-react";

interface TaskSuggestionsProps {
  onCreateTemplate: (name: string, prompt: string) => void;
}

const defaultTemplates = [
  {
    icon: Newspaper,
    label: "Newsletter",
    prompt: "Crie uma newsletter semanal com os principais acontecimentos e novidades do cliente.",
  },
  {
    icon: FileText,
    label: "Carrossel",
    prompt: "Crie um carrossel para Instagram com 5-7 slides educativos.",
  },
  {
    icon: Video,
    label: "Stories",
    prompt: "Crie uma sequência de stories com ideia central e estrutura página a página.",
  },
  {
    icon: Mail,
    label: "Thread",
    prompt: "Escreva uma thread para X/Twitter com gancho forte e insights valiosos.",
  },
  {
    icon: Image,
    label: "Post LinkedIn",
    prompt: "Crie um post para LinkedIn com storytelling e CTA claro.",
  },
  {
    icon: TrendingUp,
    label: "Estratégia",
    prompt: "Sugira uma estratégia de conteúdo mensal com temas e formatos.",
  },
];

const quickActions = [
  {
    icon: MessageCircle,
    label: "Chat Livre",
    prompt: "",
    className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20",
  },
];

export const TaskSuggestions = ({ onCreateTemplate }: TaskSuggestionsProps) => {
  const allOptions = [
    ...quickActions.map(action => ({
      icon: action.icon,
      label: action.label,
      prompt: action.prompt,
      className: action.className,
    })),
    ...defaultTemplates.map(template => ({
      icon: template.icon,
      label: template.label,
      prompt: template.prompt,
      className: undefined,
    })),
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {allOptions.map((option) => (
          <Button
            key={option.label}
            onClick={() => onCreateTemplate(option.label, option.prompt)}
            variant="outline"
            className={`h-auto py-3 px-3 flex flex-col gap-1.5 hover:border-primary hover:bg-primary/5 transition-all group ${option.className || ""}`}
          >
            <option.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-medium">{option.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

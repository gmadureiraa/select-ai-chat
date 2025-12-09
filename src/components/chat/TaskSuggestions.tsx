import { Button } from "@/components/ui/button";
import { FileText, Mail, Image, Video, TrendingUp, Newspaper, Sparkles, MessageCircle, Lightbulb } from "lucide-react";

interface TaskSuggestionsProps {
  onSelectTask: (task: string) => void;
  templates?: Array<{ id: string; name: string; type: string }>;
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
    mode: "free_chat" as const,
    className: "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/20",
  },
  {
    icon: Lightbulb,
    label: "Gerar Ideias",
    prompt: "Me dê 5 ideias de conteúdo originais e criativas para esse cliente.",
    mode: "ideas" as const,
    className: "bg-amber-500/10 border-amber-500/20 text-amber-600 hover:bg-amber-500/20",
  },
  {
    icon: Sparkles,
    label: "Alta Qualidade",
    prompt: "",
    mode: "content" as const,
    quality: "high" as const,
    className: "bg-primary/10 border-primary/20 text-primary hover:bg-primary/20",
  },
];

export const TaskSuggestions = ({ onSelectTask, templates }: TaskSuggestionsProps) => {
  const displayTemplates = templates && templates.length > 0 
    ? templates.filter(t => t.type === "chat").map(t => ({
        icon: FileText,
        label: t.name,
        prompt: `Usando o template "${t.name}", crie conteúdo seguindo as regras configuradas.`,
      }))
    : defaultTemplates;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Quick Actions */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {quickActions.map((action) => (
          <Button
            key={action.label}
            onClick={() => onSelectTask(action.prompt)}
            variant="outline"
            size="sm"
            className={`gap-1.5 ${action.className}`}
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {displayTemplates.slice(0, 6).map((task) => (
          <Button
            key={task.label}
            onClick={() => onSelectTask(task.prompt)}
            variant="outline"
            className="h-auto py-3 px-3 flex flex-col gap-1.5 hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <task.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-xs font-medium">{task.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
};

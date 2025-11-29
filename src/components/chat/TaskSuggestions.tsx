import { Button } from "@/components/ui/button";
import { FileText, Mail, Image, Video, TrendingUp, Newspaper } from "lucide-react";

interface TaskSuggestionsProps {
  onSelectTask: (task: string) => void;
}

const taskTemplates = [
  {
    icon: Newspaper,
    label: "Newsletter Semanal",
    prompt: "Crie uma newsletter semanal com os principais acontecimentos e novidades do cliente. Use um tom engajador e inclua CTAs claros.",
  },
  {
    icon: FileText,
    label: "Post para Instagram",
    prompt: "Crie um post para Instagram incluindo legenda otimizada, hashtags estratégicas e sugestão de visual.",
  },
  {
    icon: Mail,
    label: "E-mail Marketing",
    prompt: "Desenvolva um e-mail marketing completo com subject line persuasivo, estrutura clara e CTA forte.",
  },
  {
    icon: Video,
    label: "Script de Vídeo",
    prompt: "Escreva um roteiro de vídeo curto (até 60 segundos) para redes sociais, com gancho inicial forte e mensagem clara.",
  },
  {
    icon: Image,
    label: "Carrossel LinkedIn",
    prompt: "Crie um carrossel para LinkedIn com 5-7 slides, incluindo título, conteúdo de cada slide e design sugerido.",
  },
  {
    icon: TrendingUp,
    label: "Estratégia de Conteúdo",
    prompt: "Analise o cliente e sugira uma estratégia de conteúdo mensal com temas, formatos e objetivos para cada publicação.",
  },
];

export const TaskSuggestions = ({ onSelectTask }: TaskSuggestionsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
      {taskTemplates.map((task) => (
        <Button
          key={task.label}
          onClick={() => onSelectTask(task.prompt)}
          variant="outline"
          className="h-auto py-4 px-3 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <task.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-sm font-medium">{task.label}</span>
        </Button>
      ))}
    </div>
  );
};

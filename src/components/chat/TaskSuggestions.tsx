import { Button } from "@/components/ui/button";
import { FileText, Mail, Image, Video, TrendingUp, Newspaper } from "lucide-react";

interface TaskSuggestionsProps {
  onSelectTask: (task: string) => void;
}

const taskTemplates = [
  {
    icon: Newspaper,
    label: "Newsletter",
    prompt: "Crie uma newsletter semanal com os principais acontecimentos e novidades do cliente. Use um tom engajador e inclua CTAs claros.",
  },
  {
    icon: FileText,
    label: "Post Instagram",
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
    label: "Carrossel",
    prompt: "Crie um carrossel para LinkedIn com 5-7 slides, incluindo título, conteúdo de cada slide e design sugerido.",
  },
  {
    icon: TrendingUp,
    label: "Estratégia",
    prompt: "Analise o cliente e sugira uma estratégia de conteúdo mensal com temas, formatos e objetivos para cada publicação.",
  },
];

export const TaskSuggestions = ({ onSelectTask }: TaskSuggestionsProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-3 max-w-3xl mx-auto w-full">
      {taskTemplates.map((task) => (
        <Button
          key={task.label}
          onClick={() => onSelectTask(task.prompt)}
          variant="outline"
          className="h-auto py-3 md:py-4 px-2 md:px-3 flex flex-col gap-1.5 md:gap-2 hover:border-primary hover:bg-primary/5 transition-all group"
        >
          <task.icon className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-xs md:text-sm font-medium leading-tight">{task.label}</span>
        </Button>
      ))}
    </div>
  );
};
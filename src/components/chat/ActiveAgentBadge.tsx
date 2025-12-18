import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Newspaper, 
  Mail, 
  Layers, 
  Image, 
  Video, 
  Film, 
  Twitter, 
  MessageCircle, 
  Linkedin, 
  FileText, 
  BookOpen,
  ChevronDown,
  Database,
  Sparkles,
  type LucideIcon
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ContentAgentType = 
  | "newsletter_agent"
  | "email_marketing_agent"
  | "carousel_agent"
  | "static_post_agent"
  | "reels_agent"
  | "long_video_agent"
  | "tweet_agent"
  | "thread_agent"
  | "linkedin_agent"
  | "article_agent"
  | "blog_agent";

interface AgentInfo {
  name: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  rules: string[];
  dataSources: string[];
}

const AGENT_INFO: Record<ContentAgentType, AgentInfo> = {
  newsletter_agent: {
    name: "Especialista em Newsletter",
    icon: Newspaper,
    color: "text-blue-600",
    bgColor: "bg-blue-500/10",
    rules: [
      "Assunto: máx 50 caracteres, gerar curiosidade",
      "Preview text: máx 100 caracteres",
      "Tom conversacional",
      "Parágrafos curtos (máx 3 linhas)",
      "CTA principal claro"
    ],
    dataSources: ["Guia de Identidade", "Biblioteca de Conteúdo", "Guia de Copywriting"]
  },
  email_marketing_agent: {
    name: "Especialista em Email Marketing",
    icon: Mail,
    color: "text-rose-600",
    bgColor: "bg-rose-500/10",
    rules: [
      "Foque em benefícios, não features",
      "Senso de urgência sutil",
      "CTA repetido 2-3x",
      "Mobile-first",
      "PS com gatilho final"
    ],
    dataSources: ["Guia de Identidade", "Brand Assets"]
  },
  carousel_agent: {
    name: "Especialista em Carrossel",
    icon: Layers,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
    rules: [
      "Capa: máx 8 palavras",
      "Cada slide: máx 30 palavras",
      "Gancho para próximo slide",
      "Slide final: CTA + Salve + Compartilhe",
      "Máx 5 hashtags na legenda"
    ],
    dataSources: ["Guia de Identidade", "Referências Visuais", "Biblioteca de Conteúdo"]
  },
  static_post_agent: {
    name: "Especialista em Post Estático",
    icon: Image,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    rules: [
      "Uma mensagem por post",
      "Texto: máx 20 palavras",
      "Contraste alto",
      "Legenda: gancho na primeira linha",
      "Máx 5 hashtags"
    ],
    dataSources: ["Guia de Identidade", "Referências Visuais"]
  },
  reels_agent: {
    name: "Especialista em Reels",
    icon: Video,
    color: "text-pink-600",
    bgColor: "bg-pink-500/10",
    rules: [
      "Gancho: primeiros 2 segundos",
      "Cortes rápidos (máx 5s/cena)",
      "Texto na tela sempre",
      "Formato: 15-60 segundos",
      "Vertical 9:16"
    ],
    dataSources: ["Guia de Identidade", "Biblioteca de Conteúdo"]
  },
  long_video_agent: {
    name: "Especialista em Vídeo Longo",
    icon: Film,
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    rules: [
      "Gancho: 0-30 segundos",
      "Capítulos a cada 2-3 min",
      "Pattern interrupts frequentes",
      "Duração: 10-15 minutos ideal",
      "Thumbnail: rosto + emoção"
    ],
    dataSources: ["Guia de Identidade", "Biblioteca de Conteúdo", "Referências"]
  },
  tweet_agent: {
    name: "Especialista em Tweet",
    icon: Twitter,
    color: "text-sky-600",
    bgColor: "bg-sky-500/10",
    rules: [
      "Máx 280 caracteres",
      "Uma ideia por tweet",
      "Sem hashtags (ou máx 1)",
      "Evite links",
      "Linguagem conversacional"
    ],
    dataSources: ["Guia de Identidade"]
  },
  thread_agent: {
    name: "Especialista em Thread",
    icon: MessageCircle,
    color: "text-sky-600",
    bgColor: "bg-sky-500/10",
    rules: [
      "Tweet 1: gancho + 🧵",
      "5-15 tweets ideal",
      "Cada tweet independente",
      "Numerar: 1/X, 2/X",
      "Último: pedir RT"
    ],
    dataSources: ["Guia de Identidade", "Biblioteca de Conteúdo"]
  },
  linkedin_agent: {
    name: "Especialista em LinkedIn",
    icon: Linkedin,
    color: "text-blue-700",
    bgColor: "bg-blue-700/10",
    rules: [
      "Gancho nas 2 primeiras linhas",
      "Parágrafos de 1-2 linhas",
      "1200-1500 caracteres",
      "Máx 3 hashtags",
      "Terminar com pergunta"
    ],
    dataSources: ["Guia de Identidade"]
  },
  article_agent: {
    name: "Especialista em Artigos",
    icon: FileText,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    rules: [
      "1500-3000 palavras",
      "H2s e H3s estruturados",
      "Parágrafos curtos",
      "Subtítulos a cada 300-400 palavras",
      "Exemplos práticos"
    ],
    dataSources: ["Guia de Identidade", "Referências", "Base de Conhecimento"]
  },
  blog_agent: {
    name: "Especialista em Blog",
    icon: BookOpen,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    rules: [
      "SEO: palavra-chave no título",
      "Meta description: 150-160 chars",
      "1000-2000 palavras",
      "Escaneabilidade alta",
      "CTA claro"
    ],
    dataSources: ["Guia de Identidade", "Base de Conhecimento"]
  }
};

// Map template names to agent types
export function detectAgentFromTemplate(templateName: string): ContentAgentType | null {
  const patterns: Record<ContentAgentType, RegExp[]> = {
    newsletter_agent: [/newsletter/i, /news\s*letter/i],
    email_marketing_agent: [/email\s*marketing/i, /email\s*promocional/i],
    carousel_agent: [/carrossel/i, /carousel/i, /carrosel/i],
    static_post_agent: [/post\s*(estático|único|simples)/i, /imagem\s*instagram/i],
    reels_agent: [/reels?/i, /shorts?/i, /vídeo\s*curto/i],
    long_video_agent: [/vídeo\s*longo/i, /youtube/i, /roteiro\s*vídeo/i],
    tweet_agent: [/tweet\s*(único|simples)?$/i, /^tweet$/i],
    thread_agent: [/thread/i, /fio/i],
    linkedin_agent: [/linkedin/i],
    article_agent: [/artigo/i, /article/i],
    blog_agent: [/blog/i]
  };

  for (const [agentType, regexes] of Object.entries(patterns)) {
    if (regexes.some(r => r.test(templateName))) {
      return agentType as ContentAgentType;
    }
  }
  return null;
}

interface ActiveAgentBadgeProps {
  templateName: string;
  className?: string;
  showDetails?: boolean;
}

export function ActiveAgentBadge({ templateName, className, showDetails = true }: ActiveAgentBadgeProps) {
  const agentType = detectAgentFromTemplate(templateName);
  
  if (!agentType) {
    return (
      <Badge variant="outline" className={cn("gap-1.5", className)}>
        <Sparkles className="h-3 w-3" />
        Chat Livre
      </Badge>
    );
  }

  const agent = AGENT_INFO[agentType];
  const Icon = agent.icon;

  if (!showDetails) {
    return (
      <Badge 
        variant="secondary" 
        className={cn("gap-1.5", agent.bgColor, agent.color, className)}
      >
        <Icon className="h-3 w-3" />
        {agent.name}
      </Badge>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm"
          className={cn(
            "gap-1.5 h-7 px-2 font-normal",
            agent.bgColor,
            agent.color,
            "hover:opacity-80",
            className
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="text-xs">{agent.name}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className={cn("p-2 rounded-lg", agent.bgColor)}>
              <Icon className={cn("h-5 w-5", agent.color)} />
            </div>
            <div>
              <h4 className="font-semibold text-sm">{agent.name}</h4>
              <p className="text-xs text-muted-foreground">Agente ativo para este template</p>
            </div>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Regras de Formato
            </h5>
            <ul className="space-y-1">
              {agent.rules.map((rule, i) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Database className="h-3 w-3" />
              Fontes de Dados
            </h5>
            <div className="flex flex-wrap gap-1">
              {agent.dataSources.map((source, i) => (
                <Badge 
                  key={i} 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0"
                >
                  {source}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { AGENT_INFO };

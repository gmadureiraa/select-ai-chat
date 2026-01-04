import { useState } from "react";
import { Bot, Sparkles, ChevronRight, Mail, FileText, ScrollText, Image, Video, PenTool, BookOpen, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Pre-defined content agents
const contentAgents = [
  {
    id: "newsletter_agent",
    name: "Newsletter",
    description: "Especialista em e-mails editoriais com estrutura, CTAs e tom conversacional",
    icon: Mail,
    color: "from-blue-500 to-blue-600",
    platforms: ["email"],
    rules: [
      "Estrutura com assunto impactante, preview text e seções claras",
      "Tom conversacional e direto, como um amigo escrevendo",
      "CTAs estratégicos ao longo do e-mail",
      "Parágrafos curtos e escaneáveis",
      "Personalização com nome do leitor quando possível",
    ],
  },
  {
    id: "carousel_agent",
    name: "Carrossel",
    description: "Cria slides visuais para Instagram e LinkedIn com hooks e CTAs",
    icon: Image,
    color: "from-pink-500 to-purple-500",
    platforms: ["instagram", "linkedin"],
    rules: [
      "Primeiro slide com hook poderoso que gera curiosidade",
      "5-10 slides com uma ideia por slide",
      "Textos curtos e impactantes (máx 30 palavras por slide)",
      "Último slide com CTA claro",
      "Sugestões de elementos visuais para cada slide",
    ],
  },
  {
    id: "thread_agent",
    name: "Thread Twitter",
    description: "Cria threads virais com storytelling e engajamento",
    icon: ScrollText,
    color: "from-sky-400 to-blue-500",
    platforms: ["twitter"],
    rules: [
      "Primeiro tweet com hook impossível de ignorar",
      "Cada tweet com uma ideia completa (máx 280 chars)",
      "Storytelling com tensão e resolução",
      "Números, dados e exemplos concretos",
      "Último tweet com CTA e convite para seguir",
    ],
  },
  {
    id: "reels_agent",
    name: "Reels/Shorts",
    description: "Roteiros para vídeos verticais curtos com gancho e retenção",
    icon: Video,
    color: "from-red-500 to-pink-500",
    platforms: ["instagram", "tiktok", "youtube"],
    rules: [
      "Hook nos primeiros 3 segundos (parar scroll)",
      "Roteiro de 15-60 segundos máximo",
      "Estrutura: problema → solução → CTA",
      "Cortes rápidos e dinamismo",
      "Legendas sugeridas para cada cena",
    ],
  },
  {
    id: "linkedin_agent",
    name: "Post LinkedIn",
    description: "Posts profissionais com storytelling e autoridade",
    icon: FileText,
    color: "from-blue-600 to-blue-700",
    platforms: ["linkedin"],
    rules: [
      "Primeira linha impactante (visível no feed)",
      "Storytelling pessoal ou profissional",
      "Quebras de linha para escaneabilidade",
      "Hashtags relevantes (3-5 no máximo)",
      "CTA para comentários ou compartilhamento",
    ],
  },
  {
    id: "blog_agent",
    name: "Blog Post",
    description: "Artigos longos otimizados para SEO e engajamento",
    icon: BookOpen,
    color: "from-emerald-500 to-teal-500",
    platforms: ["blog", "website"],
    rules: [
      "Título otimizado para SEO com palavra-chave",
      "Meta description de 150-160 caracteres",
      "Estrutura com H2, H3 e listas",
      "Links internos e externos relevantes",
      "CTA no final e mid-article",
    ],
  },
  {
    id: "tweet_agent",
    name: "Tweet",
    description: "Posts únicos virais para Twitter/X",
    icon: MessageSquare,
    color: "from-slate-600 to-slate-700",
    platforms: ["twitter"],
    rules: [
      "Máximo 280 caracteres",
      "Uma ideia clara e impactante",
      "Uso estratégico de emojis",
      "Polêmica ou insight único",
      "Horário de publicação otimizado",
    ],
  },
  {
    id: "script_agent",
    name: "Roteiro Longo",
    description: "Roteiros para vídeos de YouTube e podcasts",
    icon: PenTool,
    color: "from-orange-500 to-amber-500",
    platforms: ["youtube", "podcast"],
    rules: [
      "Estrutura de 3 atos: intro, desenvolvimento, conclusão",
      "Hook nos primeiros 30 segundos",
      "Timestamps e capítulos sugeridos",
      "Momentos de engajamento (perguntas, comentários)",
      "CTA para inscrição e like",
    ],
  },
];

interface AgentCardProps {
  agent: typeof contentAgents[0];
  onClick: () => void;
}

function AgentCard({ agent, onClick }: AgentCardProps) {
  const Icon = agent.icon;
  
  return (
    <Card 
      className={cn(
        "group cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/40"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn(
            "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center",
            agent.color
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        <CardTitle className="text-base mt-3 group-hover:text-primary transition-colors">
          {agent.name}
        </CardTitle>
        <CardDescription className="text-sm line-clamp-2">
          {agent.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap gap-1">
          {agent.platforms.map((platform) => (
            <Badge key={platform} variant="secondary" className="text-[10px] capitalize">
              {platform}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center text-xs text-muted-foreground group-hover:text-primary transition-colors">
          Ver regras
          <ChevronRight className="h-3 w-3 ml-1" />
        </div>
      </CardContent>
    </Card>
  );
}

interface AgentRulesModalProps {
  agent: typeof contentAgents[0] | null;
  isOpen: boolean;
  onClose: () => void;
}

function AgentRulesModal({ agent, isOpen, onClose }: AgentRulesModalProps) {
  if (!agent) return null;
  const Icon = agent.icon;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn(
              "h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center",
              agent.color
            )}>
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <DialogTitle>{agent.name}</DialogTitle>
              <DialogDescription className="text-sm">
                {agent.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="mt-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            Regras do Agente
          </h4>
          <ScrollArea className="h-[250px]">
            <ul className="space-y-2">
              {agent.rules.map((rule, index) => (
                <li 
                  key={index}
                  className="flex items-start gap-2 text-sm text-muted-foreground p-2 rounded-lg bg-muted/50"
                >
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </div>

        <div className="mt-4 pt-4 border-t">
          <h4 className="text-sm font-semibold mb-2">Plataformas</h4>
          <div className="flex flex-wrap gap-1">
            {agent.platforms.map((platform) => (
              <Badge key={platform} variant="outline" className="capitalize">
                {platform}
              </Badge>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AgentsExplorer() {
  const [selectedAgent, setSelectedAgent] = useState<typeof contentAgents[0] | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6 text-primary" />
            Agentes de Conteúdo
          </h1>
          <p className="text-muted-foreground mt-1">
            Explore os agentes especializados para cada formato de conteúdo
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {contentAgents.map((agent) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            onClick={() => setSelectedAgent(agent)}
          />
        ))}
      </div>

      {/* Rules Modal */}
      <AgentRulesModal
        agent={selectedAgent}
        isOpen={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />
    </div>
  );
}

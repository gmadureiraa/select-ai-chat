import { useState } from "react";
import { Sparkles, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContentIdea {
  id: string;
  title: string;
  description: string;
  format: string;
  icon: string;
}

// Default ideas when AI isn't available or loading
const DEFAULT_IDEAS: ContentIdea[] = [
  {
    id: "1",
    title: "Bastidores do processo",
    description: "Mostre como você trabalha e gere conexão com sua audiência",
    format: "Reels/Stories",
    icon: "🎬"
  },
  {
    id: "2",
    title: "Dica rápida da semana",
    description: "Compartilhe um insight valioso em formato carrossel",
    format: "Carrossel",
    icon: "💡"
  },
  {
    id: "3",
    title: "Resposta a pergunta frequente",
    description: "Transforme uma dúvida comum em conteúdo educativo",
    format: "Post/Thread",
    icon: "❓"
  },
];

interface DynamicIdeasSectionProps {
  clientId?: string;
  clientName?: string;
  onSelectIdea: (idea: ContentIdea) => void;
}

export function DynamicIdeasSection({ clientId, clientName, onSelectIdea }: DynamicIdeasSectionProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Fetch client context for personalized ideas
  const { data: clientContext } = useQuery({
    queryKey: ['client-context-ideas', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from('clients')
        .select('name, description, identity_guide, tags')
        .eq('id', clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  // Generate personalized ideas based on client context
  const ideas: ContentIdea[] = clientContext ? [
    {
      id: "1",
      title: `Novidade de ${clientContext.name?.split(' ')[0] || 'hoje'}`,
      description: "Compartilhe uma atualização ou lançamento recente",
      format: "Carrossel",
      icon: "🚀"
    },
    {
      id: "2", 
      title: "Case de sucesso",
      description: "Mostre um resultado real que você ajudou a conquistar",
      format: "Post",
      icon: "🏆"
    },
    {
      id: "3",
      title: "Tendência do momento",
      description: "Comente sobre algo relevante no seu nicho",
      format: "Thread/Reels",
      icon: "📈"
    },
  ] : DEFAULT_IDEAS;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate refresh delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-medium text-foreground">Ideias para hoje</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          {isRefreshing ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : (
            <RefreshCw className="h-3 w-3 mr-1" />
          )}
          Novas ideias
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {ideas.map((idea, index) => (
          <motion.button
            key={idea.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => onSelectIdea(idea)}
            className={cn(
              "group relative flex flex-col items-start gap-3 p-4 rounded-xl",
              "bg-card/50 backdrop-blur-sm border border-border/50",
              "hover:bg-card hover:border-primary/30 hover:shadow-lg",
              "transition-all duration-200 text-left"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="text-2xl">{idea.icon}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {idea.format}
              </span>
            </div>
            
            <div className="space-y-1">
              <h4 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                {idea.title}
              </h4>
              <p className="text-xs text-muted-foreground line-clamp-2">
                {idea.description}
              </p>
            </div>

            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="h-4 w-4 text-primary" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

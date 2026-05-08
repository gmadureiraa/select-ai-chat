/**
 * Tab Ideas — lista as últimas "ideias" geradas pelo KAI pro cliente.
 * Botão "Gerar novas ideias" envia um prompt estruturado pro chat.
 *
 * Lê de planning_items com status='idea' como base (já integrado).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Lightbulb,
  Sparkles,
  Calendar as CalendarIcon,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useViralHunterConfig } from "./useViralHunterConfig";

interface PlanningIdea {
  id: string;
  title: string;
  content: string | null;
  platform: string | null;
  priority: string | null;
  created_at: string;
}

interface TabIdeasProps {
  clientId: string;
  clientName: string;
  onUseAsInspiration: (prompt: string) => void;
}

export function TabIdeas({ clientId, clientName, onUseAsInspiration }: TabIdeasProps) {
  const { config } = useViralHunterConfig(clientId);
  const { data: ideas = [], isLoading, isFetching, refetch } = useQuery<PlanningIdea[]>({
    queryKey: ["viral-hunter-ideas", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planning_items")
        .select("id, title, content, platform, priority, created_at")
        .eq("client_id", clientId)
        .eq("status", "idea")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PlanningIdea[];
    },
    enabled: !!clientId,
    staleTime: 60_000,
  });

  const generateIdeas = () => {
    const keywordsHint = config.keywords.length > 0
      ? `\nTemas do nicho: ${config.keywords.join(", ")}`
      : "";
    const competitorsHint = config.competitors.length > 0
      ? `\nConcorrentes monitorados: ${config.competitors.slice(0, 3).map(c => c.handle).join(", ")}`
      : "";

    const prompt = [
      `Gere 5 ideias de conteúdo acionáveis pro ${clientName} pras próximas 2 semanas.`,
      keywordsHint,
      competitorsHint,
      `\nCritérios: cada ideia deve ter (1) tema, (2) ângulo único, (3) plataforma sugerida, (4) formato. Nada genérico — ancorado no que funciona pro cliente e no que está em alta no nicho.`,
      `\nSalve cada ideia como um card no planejamento com status "idea".`,
    ].join("");

    onUseAsInspiration(prompt);
  };

  return (
    <div className="space-y-4">
      {/* CTA principal */}
      <div className="bg-gradient-to-br from-amber-100/60 to-orange-100/60 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-full bg-amber-500/20 shrink-0">
            <Lightbulb className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold mb-1">Gerar ideias com o KAI</h3>
            <p className="text-sm text-muted-foreground mb-3">
              O KAI cruza keywords do nicho{config.competitors.length > 0 ? ", concorrentes" : ""} e
              histórico do cliente pra propor 5 ideias acionáveis. Cada ideia vira um card no planejamento.
            </p>
            <Button onClick={generateIdeas} className="gap-2 bg-amber-600 hover:bg-amber-700 text-white">
              <Sparkles className="h-4 w-4" />
              Gerar 5 ideias agora
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de ideias existentes (planning_items com status=idea) */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Ideias recentes</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetch()}
          disabled={isFetching}
          className="h-7 px-2"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border/30 rounded-lg p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted/60 rounded w-full" />
            </div>
          ))}
        </div>
      ) : ideas.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground">
          Nenhuma ideia salva ainda. Clica em "Gerar 5 ideias agora" pra começar.
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-card border border-border/40 rounded-lg p-3 space-y-1 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h5 className="font-medium text-sm leading-snug">{idea.title}</h5>
                  {idea.content && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {idea.content.slice(0, 280)}
                    </p>
                  )}
                </div>
                {idea.platform && (
                  <span className="text-[10px] uppercase tracking-wide bg-muted px-1.5 py-0.5 rounded shrink-0">
                    {idea.platform}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1">
                <span className="flex items-center gap-1">
                  <CalendarIcon className="h-3 w-3" />
                  {new Date(idea.created_at).toLocaleDateString("pt-BR")}
                </span>
                <div className="flex-1" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[11px] gap-1"
                  onClick={() => {
                    onUseAsInspiration(
                      `Desenvolva essa ideia em um rascunho de post completo:\n\n${idea.title}\n${idea.content ?? ""}`,
                    );
                  }}
                >
                  Desenvolver
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

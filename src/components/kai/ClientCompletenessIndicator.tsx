import { useMemo } from "react";
import { Check, AlertCircle, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Client } from "@/hooks/useClients";
import { cn } from "@/lib/utils";

interface ClientCompletenessIndicatorProps {
  client: Client;
  documentsCount: number;
  websitesCount: number;
  onNavigateToTab?: (tab: string) => void;
}

interface CompletionItem {
  label: string;
  completed: boolean;
  tab?: string;
  weight: number;
}

export const ClientCompletenessIndicator = ({
  client,
  documentsCount,
  websitesCount,
  onNavigateToTab,
}: ClientCompletenessIndicatorProps) => {
  const completionItems = useMemo<CompletionItem[]>(() => {
    const tags = (client.tags as any) || {};
    const socialMedia = (client.social_media as any) || {};

    return [
      { label: "Nome do cliente", completed: !!client.name, tab: "general", weight: 10 },
      { label: "Descrição", completed: !!client.description, tab: "general", weight: 10 },
      { label: "Segmento/Indústria", completed: !!tags.segment, tab: "general", weight: 8 },
      { label: "Tom de voz", completed: !!tags.tone, tab: "general", weight: 10 },
      { label: "Público-alvo", completed: !!tags.audience, tab: "general", weight: 10 },
      { label: "Objetivos", completed: !!tags.objectives, tab: "general", weight: 8 },
      { label: "Diferenciais", completed: !!tags.differentials, tab: "general", weight: 8 },
      { label: "Pilares de conteúdo", completed: !!tags.content_pillars, tab: "general", weight: 8 },
      { label: "Guia de identidade", completed: !!client.identity_guide, tab: "brand", weight: 15 },
      { label: "Redes sociais (≥1)", completed: !!(socialMedia.instagram || socialMedia.twitter || socialMedia.linkedin || socialMedia.youtube), tab: "social", weight: 5 },
      { label: "Website indexado", completed: websitesCount > 0, tab: "websites", weight: 4 },
      { label: "Documento de referência", completed: documentsCount > 0, tab: "documents", weight: 4 },
    ];
  }, [client, documentsCount, websitesCount]);

  const completionScore = useMemo(() => {
    const totalWeight = completionItems.reduce((acc, item) => acc + item.weight, 0);
    const completedWeight = completionItems
      .filter((item) => item.completed)
      .reduce((acc, item) => acc + item.weight, 0);
    return Math.round((completedWeight / totalWeight) * 100);
  }, [completionItems]);

  const incompleteItems = completionItems.filter((item) => !item.completed);
  const nextSteps = incompleteItems.slice(0, 3);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-500";
    if (score >= 50) return "text-yellow-500";
    return "text-orange-500";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return { label: "Completo", variant: "default" as const };
    if (score >= 50) return { label: "Em progresso", variant: "secondary" as const };
    return { label: "Incompleto", variant: "outline" as const };
  };

  const badge = getScoreBadge(completionScore);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Completude do Perfil
            <Badge variant={badge.variant} className="text-[10px]">
              {badge.label}
            </Badge>
          </CardTitle>
          <span className={cn("text-lg font-bold", getScoreColor(completionScore))}>
            {completionScore}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={completionScore} className="h-2" />

        {nextSteps.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Próximos passos:</p>
            {nextSteps.map((item, index) => (
              <button
                key={index}
                onClick={() => item.tab && onNavigateToTab?.(item.tab)}
                className="w-full flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors text-left group"
              >
                <AlertCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <span className="text-xs flex-1">{item.label}</span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        )}

        {completionScore === 100 && (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">
              Perfil completo! O contexto da IA está otimizado.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

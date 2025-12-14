import { Mail, Eye, MousePointer, ExternalLink, Trophy, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NewsletterMetric {
  id: string;
  metric_date: string;
  views?: number | null;
  subscribers?: number | null;
  open_rate?: number | null;
  click_rate?: number | null;
  metadata?: {
    delivered?: number;
    opens?: number;
    clicks?: number;
    subject?: string;
  } | null;
}

interface BestNewsletterCardProps {
  edition: NewsletterMetric;
}

export function BestNewsletterCard({ edition }: BestNewsletterCardProps) {
  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const delivered = edition.views || edition.metadata?.delivered || 0;
  const opens = edition.metadata?.opens || 0;
  const clicks = edition.metadata?.clicks || 0;
  const subject = edition.metadata?.subject || `Edição de ${format(parseISO(edition.metric_date), "dd 'de' MMMM", { locale: ptBR })}`;

  return (
    <Card className="border-border/50 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Melhor Edição
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {format(parseISO(edition.metric_date), "dd/MM/yyyy")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject */}
        <div>
          <p className="text-sm font-medium text-foreground line-clamp-2">
            {subject}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Eye className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa Abertura</p>
              <p className="text-sm font-semibold">{(edition.open_rate || 0).toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/5">
            <div className="p-1.5 rounded-md bg-emerald-500/10">
              <MousePointer className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Taxa Clique</p>
              <p className="text-sm font-semibold">{(edition.click_rate || 0).toFixed(1)}%</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Mail className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviados</p>
              <p className="text-sm font-semibold">{formatNumber(delivered)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-500/5">
            <div className="p-1.5 rounded-md bg-violet-500/10">
              <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aberturas</p>
              <p className="text-sm font-semibold">{formatNumber(opens)}</p>
            </div>
          </div>
        </div>

        {/* Performance indicator */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
            {(edition.open_rate || 0) > 50 
              ? "Excelente taxa de abertura!" 
              : (edition.open_rate || 0) > 30 
                ? "Ótima performance!" 
                : "Bom engajamento"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

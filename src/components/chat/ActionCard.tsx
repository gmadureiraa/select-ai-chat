/**
 * ActionCard — renderiza um card de ação produzido pelo agente operador.
 *
 * O agente (via Gemini function calling) emite action_cards pra:
 *   - Rascunhos de conteúdo (draft) — com preview + botão "Usar"
 *   - Posts publicados (published) — confirmação + link
 *   - Posts agendados (scheduled) — confirmação + data
 *   - Pedido de conexão de conta (connect_account) — botão OAuth
 *   - Métricas (metric) — KPIs + gráfico inline (futuro)
 *   - Matches na biblioteca (library_match)
 *   - Erros (error)
 *
 * Este é o componente base; cada tipo tem um sub-render específico.
 * F0.6 entrega os primeiros tipos (draft + echo). F1+ evolui os demais.
 */

import { Sparkles, CheckCircle2, Calendar, Link2, BarChart3, BookOpen, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  KAIActionCard,
  KAIDraftCardData,
  KAIPublishedCardData,
  KAIScheduledCardData,
  KAIConnectAccountCardData,
  KAIMetricCardData,
  KAILibraryMatchCardData,
  KAIErrorCardData,
} from "@/types/kai-stream";

interface ActionCardProps {
  card: KAIActionCard;
  onAction?: (actionId: string, toolCall?: { name: string; args: Record<string, unknown> }) => void;
  className?: string;
}

const statusStyles: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending_approval: {
    label: "Aguardando aprovação",
    icon: <Clock className="h-3 w-3" />,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  executing: {
    label: "Executando",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  done: {
    label: "Concluído",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  error: {
    label: "Erro",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  cancelled: {
    label: "Cancelado",
    icon: <XCircle className="h-3 w-3" />,
    className: "bg-muted text-muted-foreground",
  },
};

const typeStyles: Record<string, { icon: React.ReactNode; accent: string }> = {
  draft: { icon: <Sparkles className="h-4 w-4" />, accent: "from-primary/20 to-primary/5 border-primary/30" },
  published: { icon: <CheckCircle2 className="h-4 w-4" />, accent: "from-green-500/20 to-green-500/5 border-green-500/30" },
  scheduled: { icon: <Calendar className="h-4 w-4" />, accent: "from-blue-500/20 to-blue-500/5 border-blue-500/30" },
  connect_account: { icon: <Link2 className="h-4 w-4" />, accent: "from-orange-500/20 to-orange-500/5 border-orange-500/30" },
  metric: { icon: <BarChart3 className="h-4 w-4" />, accent: "from-purple-500/20 to-purple-500/5 border-purple-500/30" },
  library_match: { icon: <BookOpen className="h-4 w-4" />, accent: "from-teal-500/20 to-teal-500/5 border-teal-500/30" },
  error: { icon: <XCircle className="h-4 w-4" />, accent: "from-red-500/20 to-red-500/5 border-red-500/30" },
};

export function ActionCard({ card, onAction, className }: ActionCardProps) {
  const status = statusStyles[card.status] ?? statusStyles.done;
  const type = typeStyles[card.type] ?? typeStyles.draft;

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br shadow-sm p-4 space-y-3",
        type.accent,
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium">
          {type.icon}
          <span className="uppercase tracking-wide text-[10px]">{labelForType(card.type)}</span>
        </div>
        <Badge variant="secondary" className={cn("gap-1 font-medium text-[10px]", status.className)}>
          {status.icon}
          {status.label}
        </Badge>
      </div>

      {/* Body — depends on card type */}
      <CardBody card={card} />

      {/* Actions */}
      {card.available_actions && card.available_actions.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t border-border/30 flex-wrap">
          {card.available_actions.map((action) => (
            <Button
              key={action.id}
              size="sm"
              variant={action.variant === "primary" ? "default" : action.variant === "danger" ? "destructive" : "outline"}
              className="h-7 text-xs gap-1.5"
              onClick={() => onAction?.(action.id, action.tool_call)}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function CardBody({ card }: { card: KAIActionCard }) {
  switch (card.data.kind) {
    case "draft":
      return <DraftBody data={card.data} />;
    case "published":
      return <PublishedBody data={card.data} />;
    case "scheduled":
      return <ScheduledBody data={card.data} />;
    case "connect_account":
      return <ConnectAccountBody data={card.data} />;
    case "metric":
      return <MetricBody data={card.data} />;
    case "library_match":
      return <LibraryMatchBody data={card.data} />;
    case "error":
      return <ErrorBody data={card.data} />;
    default:
      return (
        <pre className="text-xs overflow-auto max-h-40">
          {JSON.stringify(card.data, null, 2)}
        </pre>
      );
  }
}

function DraftBody({ data }: { data: KAIDraftCardData }) {
  // Renderer especial pra carrossel viral (estilo Twitter)
  const isViralCarousel = data.format === "viral_carousel";
  const viralSlides = (data as unknown as { viralSlides?: Array<{ body: string }> }).viralSlides;

  if (isViralCarousel && Array.isArray(viralSlides) && viralSlides.length > 0) {
    return (
      <div className="space-y-2">
        {data.title && <p className="text-sm font-semibold">{data.title}</p>}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
          <span>Sequência Viral</span>
          <span>·</span>
          <span>{viralSlides.length} slides</span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {viralSlides.map((s, i) => (
            <div
              key={i}
              className="shrink-0 w-32 h-40 rounded-md border border-border/40 bg-gradient-to-br from-sky-50 to-background dark:from-sky-950/40 p-2 text-[9px] leading-tight overflow-hidden"
              title={s.body}
            >
              <div className="text-[8px] font-mono text-sky-600 dark:text-sky-400 mb-1">
                {String(i + 1).padStart(2, "0")}/{viralSlides.length}
              </div>
              <p className="line-clamp-8 whitespace-pre-wrap">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {data.title && (
        <p className="text-sm font-semibold">{data.title}</p>
      )}
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-wide">
        <span>{data.platform}</span>
        <span>·</span>
        <span>{data.format}</span>
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed line-clamp-10">
        {data.body}
      </p>
      {data.hashtags && data.hashtags.length > 0 && (
        <p className="text-xs text-primary">
          {data.hashtags.map((h) => `#${h}`).join(" ")}
        </p>
      )}
      {data.mediaUrls && data.mediaUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {data.mediaUrls.map((url, i) => (
            <img
              key={i}
              src={url}
              alt=""
              className="h-20 rounded-md object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PublishedBody({ data }: { data: KAIPublishedCardData }) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="line-clamp-3 whitespace-pre-wrap">{data.body}</p>
      <p className="text-xs text-muted-foreground">
        Publicado em <strong>{data.platform}</strong> às {new Date(data.publishedAt).toLocaleString("pt-BR")}
      </p>
      {data.externalUrl && (
        <a
          href={data.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver post <Link2 className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function ScheduledBody({ data }: { data: KAIScheduledCardData }) {
  return (
    <div className="space-y-1.5 text-sm">
      <p className="line-clamp-3 whitespace-pre-wrap">{data.body}</p>
      <p className="text-xs text-muted-foreground">
        Agendado pra <strong>{data.platform}</strong> em {new Date(data.scheduledFor).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

function ConnectAccountBody({ data }: { data: KAIConnectAccountCardData }) {
  return (
    <div className="space-y-2">
      <p className="text-sm">{data.reason}</p>
      <Button
        size="sm"
        onClick={() => window.open(data.oauthUrl, "_blank")}
        className="gap-1.5"
      >
        <Link2 className="h-3.5 w-3.5" />
        Conectar {data.platform}
      </Button>
    </div>
  );
}

function MetricBody({ data }: { data: KAIMetricCardData }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="text-xs text-muted-foreground">
        {data.platform ? `${data.platform} · ` : ""}{data.period}
      </p>
      {data.kpis && data.kpis.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {data.kpis.map((k, i) => (
            <div key={i} className="bg-background/70 rounded-md p-2 border border-border/30">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</p>
              <p className="text-sm font-semibold">{k.value}</p>
              {k.delta && <p className="text-[10px] text-muted-foreground">{k.delta}</p>}
            </div>
          ))}
        </div>
      )}
      <p className="leading-relaxed">{data.summary}</p>
    </div>
  );
}

function LibraryMatchBody({ data }: { data: KAILibraryMatchCardData }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {data.matches.length} resultados na biblioteca
      </p>
      <ul className="space-y-1 text-sm">
        {data.matches.slice(0, 5).map((m) => (
          <li key={m.id} className="leading-snug">
            <strong>{m.title}</strong>
            {m.snippet && <span className="text-muted-foreground"> — {m.snippet}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBody({ data }: { data: KAIErrorCardData }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="text-red-700 dark:text-red-400 font-medium">{data.message}</p>
      {data.toolName && (
        <p className="text-xs text-muted-foreground">Tool: {data.toolName}</p>
      )}
    </div>
  );
}

function labelForType(type: KAIActionCard["type"]): string {
  const labels: Record<string, string> = {
    draft: "📝 Rascunho",
    published: "🚀 Publicado",
    scheduled: "📅 Agendado",
    connect_account: "🔗 Conectar conta",
    metric: "📊 Métrica",
    library_match: "📚 Biblioteca",
    error: "⚠️ Erro",
  };
  return labels[type] ?? type;
}

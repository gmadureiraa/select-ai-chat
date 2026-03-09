import { useState } from "react";
import { useLateAnalytics, PlatformMetrics } from "@/hooks/useLateAnalytics";
import { cn } from "@/lib/utils";
import { 
  RefreshCw, TrendingUp, TrendingDown, Eye, Heart, MessageCircle, 
  Share2, Users, ExternalLink, BarChart3, Minus, Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface KaiAnalyticsTabProps {
  clientId: string;
  client: any;
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  twitter: "X / Twitter",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
  threads: "Threads",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "from-pink-500 to-purple-500",
  twitter: "from-sky-400 to-blue-500",
  linkedin: "from-blue-600 to-blue-800",
  tiktok: "from-pink-500 to-cyan-400",
  youtube: "from-red-500 to-red-700",
  threads: "from-gray-700 to-gray-900",
};

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString("pt-BR");
}

function MiniSparkline({ data }: { data: Array<{ followers: number }> }) {
  if (!data || data.length < 2) return null;
  const values = data.map(d => d.followers);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="text-primary">
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({ icon: Icon, label, value, subValue, trend }: {
  icon: any;
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="bg-card border rounded-lg p-4 space-y-1">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      {subValue && (
        <div className="flex items-center gap-1 text-xs">
          {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
          {trend === "down" && <TrendingDown className="h-3 w-3 text-red-500" />}
          {trend === "neutral" && <Minus className="h-3 w-3 text-muted-foreground" />}
          <span className={cn(
            trend === "up" && "text-green-500",
            trend === "down" && "text-red-500",
            trend === "neutral" && "text-muted-foreground"
          )}>{subValue}</span>
        </div>
      )}
    </div>
  );
}

function PlatformSection({ platform, data }: { platform: string; data: PlatformMetrics }) {
  const { followerStats, recentPosts, aggregates } = data;
  const followerTrend = followerStats.change7d > 0 ? "up" : followerStats.change7d < 0 ? "down" : "neutral";

  return (
    <div className="space-y-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          icon={Users}
          label="Seguidores"
          value={formatNumber(followerStats.current)}
          subValue={`${followerStats.change7d >= 0 ? "+" : ""}${formatNumber(followerStats.change7d)} (7d)`}
          trend={followerTrend}
        />
        <MetricCard
          icon={BarChart3}
          label="Eng. Rate Médio"
          value={`${aggregates.avgEngagementRate.toFixed(2)}%`}
          subValue={`${aggregates.postsCount} posts analisados`}
        />
        <MetricCard
          icon={Eye}
          label="Impressões"
          value={formatNumber(aggregates.totalImpressions)}
          subValue={aggregates.totalReach > 0 ? `${formatNumber(aggregates.totalReach)} alcance` : undefined}
        />
        <MetricCard
          icon={Heart}
          label="Curtidas"
          value={formatNumber(aggregates.totalLikes)}
          subValue={`${formatNumber(aggregates.totalComments)} comentários`}
        />
      </div>

      {/* Follower Sparkline */}
      {followerStats.history.length > 2 && (
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">Crescimento de seguidores (30d)</span>
            <span className={cn(
              "text-xs font-medium",
              followerStats.change30d > 0 ? "text-green-500" : followerStats.change30d < 0 ? "text-red-500" : "text-muted-foreground"
            )}>
              {followerStats.change30d >= 0 ? "+" : ""}{formatNumber(followerStats.change30d)}
            </span>
          </div>
          <MiniSparkline data={followerStats.history} />
        </div>
      )}

      {/* Recent Posts Table */}
      {recentPosts.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h4 className="text-sm font-medium">Top Posts Recentes</h4>
          </div>
          <div className="divide-y">
            {recentPosts.map((post, i) => (
              <div key={post.id || i} className="px-4 py-3 flex items-start gap-3 hover:bg-accent/50 transition-colors">
                <span className="text-xs font-mono text-muted-foreground mt-0.5 w-5 flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{post.content || "Sem legenda"}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />{formatNumber(post.metrics.impressions)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />{formatNumber(post.metrics.likes)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3 w-3" />{formatNumber(post.metrics.comments)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Share2 className="h-3 w-3" />{formatNumber(post.metrics.shares)}
                    </span>
                    {post.metrics.engagementRate > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {post.metrics.engagementRate.toFixed(2)}% ER
                      </Badge>
                    )}
                  </div>
                </div>
                {post.url && (
                  <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function KaiAnalyticsTab({ clientId, client }: KaiAnalyticsTabProps) {
  const [period, setPeriod] = useState(7);
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useLateAnalytics(clientId, period);

  const platformKeys = data?.platforms ? Object.keys(data.platforms) : [];
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const selectedPlatform = activePlatform || platformKeys[0] || null;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
            <Badge variant="secondary" className="text-[10px] font-semibold tracking-wider uppercase">
              Beta
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Métricas em tempo real via Late API — {client?.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period Toggle */}
          <div className="flex border rounded-md overflow-hidden">
            {[7, 30].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium transition-colors",
                  period === p ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                {p}d
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Sync Status */}
      {dataUpdatedAt > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>Última atualização: {formatDistanceToNow(dataUpdatedAt, { locale: ptBR, addSuffix: true })}</span>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Buscando métricas da Late API...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">Erro ao buscar métricas: {(error as Error).message}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* No platforms */}
      {data && platformKeys.length === 0 && !isLoading && (
        <div className="bg-card border rounded-lg p-8 text-center">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="font-medium">Nenhuma plataforma conectada</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {data.message || "Conecte plataformas via Late para ver métricas em tempo real."}
          </p>
        </div>
      )}

      {/* Platform Tabs */}
      {platformKeys.length > 0 && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {platformKeys.map(key => (
              <button
                key={key}
                onClick={() => setActivePlatform(key)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap border",
                  selectedPlatform === key
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card hover:bg-accent border-border"
                )}
              >
                {PLATFORM_LABELS[key] || key}
              </button>
            ))}
          </div>

          {/* Platform Content */}
          {selectedPlatform && data?.platforms[selectedPlatform] && (
            <PlatformSection
              platform={selectedPlatform}
              data={data.platforms[selectedPlatform]}
            />
          )}
        </>
      )}
    </div>
  );
}

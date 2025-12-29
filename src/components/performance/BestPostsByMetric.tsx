import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, MessageCircle, Bookmark, Share2, Eye, MousePointer, HelpCircle } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BestPostsByMetricProps {
  posts: InstagramPost[];
  previousPeriodPosts?: InstagramPost[];
  periodLabel?: string;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  previousValue?: number;
  post: InstagramPost | null;
  color: string;
  helpText?: string;
}

const formatNumber = (num: number) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString('pt-BR');
};

const calcChange = (current: number, previous: number) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

function MetricCard({ icon: Icon, label, value, previousValue, post, color, helpText }: MetricCardProps) {
  const change = previousValue !== undefined ? calcChange(value, previousValue) : undefined;
  
  return (
    <Card className="border-border/30 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            {helpText && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">{helpText}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <Icon className={cn("h-4 w-4", color)} />
        </div>
        
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-2xl font-bold tracking-tight">{formatNumber(value)}</span>
          {change !== undefined && (
            <span className={cn(
              "text-xs font-medium",
              change > 0 ? "text-emerald-500" : change < 0 ? "text-rose-500" : "text-muted-foreground"
            )}>
              {change > 0 ? "▲" : change < 0 ? "▼" : ""} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        
        {previousValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            {formatNumber(previousValue)} no período anterior
          </p>
        )}
        
        {post && post.thumbnail_url && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <p className="text-xs text-muted-foreground mb-2">Melhor post:</p>
            <div className="flex items-center gap-2">
              <img 
                src={post.thumbnail_url} 
                alt="Melhor post"
                className="w-10 h-10 rounded object-cover flex-shrink-0"
                onError={(e) => e.currentTarget.style.display = 'none'}
              />
              <p className="text-xs line-clamp-2 flex-1">
                {post.caption?.slice(0, 60) || "Sem legenda"}
                {post.caption && post.caption.length > 60 ? "..." : ""}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function BestPostsByMetric({ posts, previousPeriodPosts = [], periodLabel }: BestPostsByMetricProps) {
  // Calculate totals for current period
  const totalPosts = posts.length;
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalSaves = posts.reduce((sum, p) => sum + (p.saves || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
  const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const totalInteractions = totalLikes + totalComments + totalSaves + totalShares;

  // Calculate totals for previous period
  const prevPosts = previousPeriodPosts.length;
  const prevLikes = previousPeriodPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const prevSaves = previousPeriodPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
  const prevComments = previousPeriodPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const prevShares = previousPeriodPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
  const prevReach = previousPeriodPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const prevInteractions = prevLikes + prevComments + prevSaves + prevShares;

  // Find best posts by each metric
  const bestBySaves = posts.length > 0 
    ? [...posts].sort((a, b) => (b.saves || 0) - (a.saves || 0))[0] 
    : null;
  const bestByLikes = posts.length > 0 
    ? [...posts].sort((a, b) => (b.likes || 0) - (a.likes || 0))[0] 
    : null;
  const bestByComments = posts.length > 0 
    ? [...posts].sort((a, b) => (b.comments || 0) - (a.comments || 0))[0] 
    : null;
  const bestByShares = posts.length > 0 
    ? [...posts].sort((a, b) => (b.shares || 0) - (a.shares || 0))[0] 
    : null;
  const bestByReach = posts.length > 0 
    ? [...posts].sort((a, b) => (b.reach || 0) - (a.reach || 0))[0] 
    : null;

  if (posts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Métricas de Postagens</h3>
        {periodLabel && (
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
            {periodLabel}
          </span>
        )}
      </div>
      
      {/* First row: Posts count + Reach + Interactions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          icon={Eye}
          label="Número de postagens do feed"
          value={totalPosts}
          previousValue={prevPosts > 0 ? prevPosts : undefined}
          post={null}
          color="text-blue-500"
          helpText="Total de posts publicados no período selecionado"
        />
        <MetricCard
          icon={Eye}
          label="Alcance das postagens"
          value={totalReach}
          previousValue={prevReach > 0 ? prevReach : undefined}
          post={bestByReach}
          color="text-purple-500"
          helpText="Número de contas únicas que viram suas postagens"
        />
        <MetricCard
          icon={Heart}
          label="Interações nas postagens"
          value={totalInteractions}
          previousValue={prevInteractions > 0 ? prevInteractions : undefined}
          post={null}
          color="text-rose-500"
          helpText="Soma de curtidas, comentários, salvamentos e compartilhamentos"
        />
      </div>

      {/* Second row: Likes, Saves, Comments, Shares */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Heart}
          label="Curtidas em postagens"
          value={totalLikes}
          previousValue={prevLikes > 0 ? prevLikes : undefined}
          post={bestByLikes}
          color="text-rose-500"
          helpText="Total de curtidas recebidas nas postagens"
        />
        <MetricCard
          icon={Bookmark}
          label="Salvamento das postagens"
          value={totalSaves}
          previousValue={prevSaves > 0 ? prevSaves : undefined}
          post={bestBySaves}
          color="text-amber-500"
          helpText="Total de vezes que suas postagens foram salvas"
        />
        <MetricCard
          icon={MessageCircle}
          label="Comentários em postagens"
          value={totalComments}
          previousValue={prevComments > 0 ? prevComments : undefined}
          post={bestByComments}
          color="text-blue-500"
          helpText="Total de comentários recebidos nas postagens"
        />
        <MetricCard
          icon={Share2}
          label="Compartilhamento das postagens"
          value={totalShares}
          previousValue={prevShares > 0 ? prevShares : undefined}
          post={bestByShares}
          color="text-emerald-500"
          helpText="Total de vezes que suas postagens foram compartilhadas"
        />
      </div>
    </div>
  );
}

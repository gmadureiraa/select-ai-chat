import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, MessageCircle, Bookmark, Share2, Eye, HelpCircle, TrendingUp, Users } from "lucide-react";
import { InstagramPost } from "@/hooks/useInstagramPosts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BestPostsByMetricProps {
  posts: InstagramPost[];
  previousPeriodPosts?: InstagramPost[];
  periodLabel?: string;
  followersGained?: number;
  prevFollowersGained?: number;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  previousValue?: number;
  color: string;
  helpText?: string;
  isPercent?: boolean;
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

function MetricCard({ icon: Icon, label, value, previousValue, color, helpText, isPercent }: MetricCardProps) {
  const change = previousValue !== undefined ? calcChange(value, previousValue) : undefined;
  const displayValue = isPercent ? `${value.toFixed(2)}%` : formatNumber(value);
  const displayPrevValue = isPercent && previousValue !== undefined ? `${previousValue.toFixed(2)}%` : previousValue !== undefined ? formatNumber(previousValue) : undefined;
  
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
          <span className="text-2xl font-bold tracking-tight">{displayValue}</span>
          {change !== undefined && (
            <span className={cn(
              "text-xs font-medium",
              change > 0 ? "text-emerald-500" : change < 0 ? "text-rose-500" : "text-muted-foreground"
            )}>
              {change > 0 ? "▲" : change < 0 ? "▼" : ""} {Math.abs(change).toFixed(1)}%
            </span>
          )}
        </div>
        
        {displayPrevValue !== undefined && (
          <p className="text-xs text-muted-foreground">
            {displayPrevValue} no período anterior
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function BestPostsByMetric({ posts, previousPeriodPosts = [], periodLabel, followersGained, prevFollowersGained }: BestPostsByMetricProps) {
  if (!posts || posts.length === 0) return null;

  // Current period totals
  const totalSaves = posts.reduce((sum, p) => sum + (p.saves || 0), 0);
  const totalLikes = posts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const totalComments = posts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const totalShares = posts.reduce((sum, p) => sum + (p.shares || 0), 0);
  const totalReach = posts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const totalInteractions = totalLikes + totalComments + totalShares + totalSaves;
  const postCount = posts.length;
  
  // Average engagement
  const avgEngagement = posts.length > 0
    ? posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / posts.length
    : 0;

  // Previous period totals
  const prevSaves = previousPeriodPosts.reduce((sum, p) => sum + (p.saves || 0), 0);
  const prevLikes = previousPeriodPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const prevComments = previousPeriodPosts.reduce((sum, p) => sum + (p.comments || 0), 0);
  const prevShares = previousPeriodPosts.reduce((sum, p) => sum + (p.shares || 0), 0);
  const prevReach = previousPeriodPosts.reduce((sum, p) => sum + (p.reach || 0), 0);
  const prevInteractions = prevLikes + prevComments + prevShares + prevSaves;
  const prevPostCount = previousPeriodPosts.length;
  
  // Previous average engagement
  const prevAvgEngagement = previousPeriodPosts.length > 0
    ? previousPeriodPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / previousPeriodPosts.length
    : 0;

  const hasPreviousData = previousPeriodPosts.length > 0;

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
      
      {/* First row: Posts count + Reach + Interactions + Avg Engagement */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Eye}
          label="Número de postagens"
          value={postCount}
          previousValue={hasPreviousData ? prevPostCount : undefined}
          color="text-blue-500"
          helpText="Total de posts publicados no período selecionado"
        />
        <MetricCard
          icon={Eye}
          label="Alcance das postagens"
          value={totalReach}
          previousValue={hasPreviousData ? prevReach : undefined}
          color="text-purple-500"
          helpText="Número de contas únicas que viram suas postagens"
        />
        <MetricCard
          icon={Heart}
          label="Interações totais"
          value={totalInteractions}
          previousValue={hasPreviousData ? prevInteractions : undefined}
          color="text-rose-500"
          helpText="Soma de curtidas, comentários, salvamentos e compartilhamentos"
        />
        <MetricCard
          icon={TrendingUp}
          label="Engajamento médio"
          value={avgEngagement}
          previousValue={hasPreviousData ? prevAvgEngagement : undefined}
          color="text-primary"
          helpText="Taxa média de engajamento dos posts (interações/alcance)"
          isPercent={true}
        />
      </div>

      {/* Second row: Likes, Saves, Comments, Shares */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={Heart}
          label="Curtidas"
          value={totalLikes}
          previousValue={hasPreviousData ? prevLikes : undefined}
          color="text-rose-500"
          helpText="Total de curtidas recebidas nas postagens"
        />
        <MetricCard
          icon={Bookmark}
          label="Salvamentos"
          value={totalSaves}
          previousValue={hasPreviousData ? prevSaves : undefined}
          color="text-amber-500"
          helpText="Total de vezes que suas postagens foram salvas"
        />
        <MetricCard
          icon={MessageCircle}
          label="Comentários"
          value={totalComments}
          previousValue={hasPreviousData ? prevComments : undefined}
          color="text-blue-500"
          helpText="Total de comentários recebidos nas postagens"
        />
        <MetricCard
          icon={Share2}
          label="Compartilhamentos"
          value={totalShares}
          previousValue={hasPreviousData ? prevShares : undefined}
          color="text-emerald-500"
          helpText="Total de vezes que suas postagens foram compartilhadas"
        />
      </div>

      {/* Followers Gained Card (if provided) */}
      {followersGained !== undefined && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            icon={Users}
            label="Seguidores ganhos no período"
            value={followersGained}
            previousValue={prevFollowersGained}
            color="text-primary"
            helpText="Novos seguidores ganhos durante o período (métrica do perfil, não por post)"
          />
        </div>
      )}
    </div>
  );
}

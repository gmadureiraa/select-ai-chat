import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Minus, Eye, Heart, MessageCircle, ExternalLink, Bookmark, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentItem {
  id: string;
  title: string;
  thumbnail?: string;
  type?: string;
  views?: number;
  likes?: number;
  comments?: number;
  saves?: number;
  shares?: number;
  reach?: number;
  engagement?: number;
  trend?: number; // percentage change
  link?: string;
}

type MetricType = "engagement" | "saves" | "shares" | "likes" | "comments" | "reach";

interface TopContentTableProps {
  title: string;
  items: ContentItem[];
  maxItems?: number;
  selectedMetric?: MetricType;
  onMetricChange?: (metric: MetricType) => void;
}

const metricLabels: Record<MetricType, string> = {
  engagement: "Engajamento",
  saves: "Salvamentos",
  shares: "Compartilhamentos",
  likes: "Curtidas",
  comments: "Comentários",
  reach: "Alcance",
};

const TrendIndicator = ({ value }: { value?: number }) => {
  if (value === undefined || value === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  
  if (value > 0) {
    return (
      <div className="flex items-center gap-0.5 text-emerald-500">
        <TrendingUp className="h-3 w-3" />
        <span className="text-xs font-medium">+{value.toFixed(1)}%</span>
      </div>
    );
  }
  
  if (value < 0) {
    return (
      <div className="flex items-center gap-0.5 text-rose-500">
        <TrendingDown className="h-3 w-3" />
        <span className="text-xs font-medium">{value.toFixed(1)}%</span>
      </div>
    );
  }
  
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

const formatNumber = (num?: number) => {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

const getMetricValue = (item: ContentItem, metric: MetricType): number => {
  switch (metric) {
    case "engagement": return item.engagement || 0;
    case "saves": return item.saves || 0;
    case "shares": return item.shares || 0;
    case "likes": return item.likes || 0;
    case "comments": return item.comments || 0;
    case "reach": return item.reach || 0;
    default: return 0;
  }
};

export function TopContentTable({ 
  title, 
  items, 
  maxItems = 5,
  selectedMetric = "engagement",
  onMetricChange,
}: TopContentTableProps) {
  // Sort items by selected metric
  const sortedItems = [...items].sort((a, b) => 
    getMetricValue(b, selectedMetric) - getMetricValue(a, selectedMetric)
  );
  const displayItems = sortedItems.slice(0, maxItems);

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {onMetricChange && (
            <Select value={selectedMetric} onValueChange={(v) => onMetricChange(v as MetricType)}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement">Engajamento</SelectItem>
                <SelectItem value="saves">Salvamentos</SelectItem>
                <SelectItem value="shares">Compartilhamentos</SelectItem>
                <SelectItem value="likes">Curtidas</SelectItem>
                <SelectItem value="comments">Comentários</SelectItem>
                <SelectItem value="reach">Alcance</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Sem conteúdo disponível
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item, index) => (
              <div 
                key={item.id}
                className={cn(
                  "flex items-center gap-3 p-2.5 rounded-lg transition-colors",
                  "hover:bg-muted/50 group"
                )}
              >
                {/* Rank number */}
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                </div>

                {/* Thumbnail */}
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-orange-500/20">
                  {item.thumbnail ? (
                    <img 
                      src={item.thumbnail} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Title & Type */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.type && (
                    <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                  )}
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1 text-muted-foreground" title="Alcance">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.reach)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground" title="Curtidas">
                    <Heart className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.likes)}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground" title="Salvamentos">
                    <Bookmark className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.saves)}</span>
                  </div>
                  <div className="hidden md:flex items-center gap-1 text-muted-foreground" title="Compartilhamentos">
                    <Share2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.shares)}</span>
                  </div>
                </div>

                {/* Primary metric value */}
                <div className="flex-shrink-0 w-20 text-right">
                  <span className="text-sm font-semibold text-foreground">
                    {selectedMetric === "engagement" 
                      ? `${getMetricValue(item, selectedMetric).toFixed(1)}%`
                      : formatNumber(getMetricValue(item, selectedMetric))
                    }
                  </span>
                </div>

                {/* Link */}
                {item.link && (
                  <a 
                    href={item.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
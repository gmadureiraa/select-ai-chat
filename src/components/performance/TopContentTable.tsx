import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, Eye, Heart, MessageCircle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentItem {
  id: string;
  title: string;
  thumbnail?: string;
  type?: string;
  views?: number;
  likes?: number;
  comments?: number;
  engagement?: number;
  trend?: number; // percentage change
  link?: string;
}

interface TopContentTableProps {
  title: string;
  items: ContentItem[];
  maxItems?: number;
}

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

export function TopContentTable({ 
  title, 
  items, 
  maxItems = 5 
}: TopContentTableProps) {
  const displayItems = items.slice(0, maxItems);

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
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
                {item.thumbnail ? (
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    <img 
                      src={item.thumbnail} 
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}

                {/* Title & Type */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.title}</p>
                  {item.type && (
                    <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                  )}
                </div>

                {/* Metrics */}
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Eye className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.views)}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Heart className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.likes)}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-muted-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">{formatNumber(item.comments)}</span>
                  </div>
                </div>

                {/* Trend */}
                <div className="flex-shrink-0 w-16 flex justify-end">
                  <TrendIndicator value={item.trend} />
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

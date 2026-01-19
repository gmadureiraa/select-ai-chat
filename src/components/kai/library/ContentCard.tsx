import { Instagram, Youtube, MessageSquare, Linkedin, FileText, Heart, MessageCircle, ExternalLink, Star, Eye, GripVertical } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type CardSize = "compact" | "medium" | "large";

interface ContentCardProps {
  item: UnifiedContentItem;
  onClick?: () => void;
  onSelect?: () => void;
  onToggleFavorite?: () => void;
  onPreview?: () => void;
  selected?: boolean;
  compact?: boolean;
  size?: CardSize;
  draggable?: boolean;
}

const platformIcons = {
  instagram: Instagram,
  youtube: Youtube,
  twitter: MessageSquare,
  linkedin: Linkedin,
  newsletter: FileText,
  content: FileText,
};

const platformColors = {
  instagram: "text-pink-500",
  youtube: "text-red-500",
  twitter: "text-blue-400",
  linkedin: "text-blue-600",
  newsletter: "text-orange-500",
  content: "text-muted-foreground",
};

const platformBgColors = {
  instagram: "bg-pink-500/10",
  youtube: "bg-red-500/10",
  twitter: "bg-blue-400/10",
  linkedin: "bg-blue-600/10",
  newsletter: "bg-orange-500/10",
  content: "bg-muted/50",
};

export function ContentCard({ 
  item, 
  onClick, 
  onSelect, 
  onToggleFavorite,
  onPreview,
  selected, 
  compact,
  size = "medium",
  draggable 
}: ContentCardProps) {
  const Icon = platformIcons[item.platform] ?? FileText;
  const formattedDate = format(new Date(item.posted_at), "dd MMM yyyy", { locale: ptBR });

  // Compact view
  if (compact || size === "compact") {
    return (
      <div
        onClick={onClick || onSelect}
        draggable={draggable}
        className={cn(
          "w-full text-left p-3 rounded-lg border transition-all cursor-pointer",
          "hover:bg-accent/50 hover:border-primary/30",
          selected && "bg-primary/10 border-primary ring-2 ring-primary/20",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
      >
        <div className="flex items-start gap-3">
          {draggable && (
            <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 flex-shrink-0" />
          )}
          <div className={cn("p-1.5 rounded-md flex-shrink-0", platformBgColors[item.platform])}>
            <Icon className={cn("h-3.5 w-3.5", platformColors[item.platform])} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {item.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            )}
            {item.engagement_rate && (
              <Badge variant="secondary" className="text-[10px]">
                {item.engagement_rate.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Medium view - show more content
  if (size === "medium") {
    return (
      <div
        onClick={onClick || onSelect}
        draggable={draggable}
        className={cn(
          "group relative rounded-xl border bg-card overflow-hidden transition-all cursor-pointer",
          "hover:shadow-lg hover:border-primary/30",
          selected && "ring-2 ring-primary border-primary",
          draggable && "cursor-grab active:cursor-grabbing"
        )}
      >
        {/* Thumbnail */}
        {item.thumbnail_url ? (
          <div className="aspect-video bg-muted overflow-hidden">
            <img
              src={item.thumbnail_url}
              alt={item.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/1a1a2e/666?text=📄';
              }}
            />
          </div>
        ) : (
          <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
            <Icon className={cn("h-10 w-10", platformColors[item.platform], "opacity-50")} />
          </div>
        )}

        {/* Platform badge */}
        <div className="absolute top-2 left-2">
          <div className={cn("p-1.5 rounded-lg backdrop-blur-sm", platformBgColors[item.platform])}>
            <Icon className={cn("h-4 w-4", platformColors[item.platform])} />
          </div>
        </div>

        {/* Engagement badge */}
        {item.engagement_rate && item.engagement_rate > 0 && (
          <div className="absolute top-2 right-2">
            <Badge className="bg-green-500/90 text-white text-[10px]">
              {item.engagement_rate.toFixed(1)}% eng
            </Badge>
          </div>
        )}

        {/* Content */}
        <div className="p-3 space-y-2">
          <p className="text-sm font-medium line-clamp-2">{item.title}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{item.content.substring(0, 100)}</p>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formattedDate}</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-0.5">
                <Heart className="h-3 w-3" />
                {item.metrics.likes}
              </span>
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-3 w-3" />
                {item.metrics.comments}
              </span>
            </div>
          </div>

          {/* Actions on hover */}
          <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {onPreview && (
              <Button 
                size="sm" 
                variant="secondary"
                className="flex-1 h-7 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview();
                }}
              >
                <Eye className="h-3 w-3" />
                Ver completo
              </Button>
            )}
            {onToggleFavorite && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
              >
                <Star className={cn("h-3 w-3", item.is_favorite && "fill-yellow-400 text-yellow-400")} />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Large view - full content
  return (
    <div
      onClick={onClick || onSelect}
      draggable={draggable}
      className={cn(
        "group relative rounded-xl border bg-card overflow-hidden transition-all cursor-pointer",
        "hover:shadow-lg hover:border-primary/30",
        selected && "ring-2 ring-primary border-primary",
        draggable && "cursor-grab active:cursor-grabbing"
      )}
    >
      {/* Thumbnail */}
      {item.thumbnail_url ? (
        <div className="aspect-video bg-muted overflow-hidden">
          <img
            src={item.thumbnail_url}
            alt={item.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://placehold.co/400x225/1a1a2e/666?text=📄';
            }}
          />
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
          <Icon className={cn("h-12 w-12", platformColors[item.platform], "opacity-50")} />
        </div>
      )}

      {/* Platform badge */}
      <div className="absolute top-2 left-2">
        <div className={cn("p-1.5 rounded-lg backdrop-blur-sm", platformBgColors[item.platform])}>
          <Icon className={cn("h-4 w-4", platformColors[item.platform])} />
        </div>
      </div>

      {/* Favorite badge */}
      {item.is_favorite && (
        <div className="absolute top-2 right-10">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400 drop-shadow-md" />
        </div>
      )}

      {/* Engagement badge */}
      {item.engagement_rate && item.engagement_rate > 0 && (
        <div className="absolute top-2 right-2">
          <Badge className="bg-green-500/90 text-white text-[10px]">
            {item.engagement_rate.toFixed(1)}% eng
          </Badge>
        </div>
      )}

      {/* Content */}
      <div className="p-4 space-y-3">
        <p className="text-base font-medium line-clamp-2">{item.title}</p>
        
        {/* Full content preview */}
        <div className="text-sm text-muted-foreground line-clamp-5 whitespace-pre-wrap">
          {item.content.substring(0, 400)}
          {item.content.length > 400 && "..."}
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>{formattedDate}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {item.metrics.likes}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" />
              {item.metrics.comments}
            </span>
          </div>
        </div>

        {/* Actions on hover */}
        <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPreview && (
            <Button 
              size="sm" 
              variant="secondary"
              className="flex-1 h-8 text-xs gap-1"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
            >
              <Eye className="h-3 w-3" />
              Ver completo
            </Button>
          )}
          {onToggleFavorite && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Star className={cn("h-3 w-3", item.is_favorite && "fill-yellow-400 text-yellow-400")} />
            </Button>
          )}
          {item.permalink && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-3"
              onClick={(e) => {
                e.stopPropagation();
                window.open(item.permalink, '_blank');
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

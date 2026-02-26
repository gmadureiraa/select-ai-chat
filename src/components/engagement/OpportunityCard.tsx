import { EngagementOpportunity } from "@/hooks/useEngagementFeed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Heart, MessageCircle, Repeat2, Bookmark, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface OpportunityCardProps {
  opportunity: EngagementOpportunity;
  isSelected: boolean;
  onSelect: () => void;
  onDismiss: () => void;
  onSave: () => void;
}

const categoryConfig: Record<string, { label: string; color: string }> = {
  networking: { label: 'Networking', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  community: { label: 'Comunidade', color: 'bg-green-500/10 text-green-600 dark:text-green-400' },
  growth: { label: 'Crescimento', color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
};

export function OpportunityCard({ opportunity, isSelected, onSelect, onDismiss, onSave }: OpportunityCardProps) {
  const cat = categoryConfig[opportunity.category] || categoryConfig.community;
  const metrics = opportunity.tweet_metrics || {};
  const timeAgo = opportunity.tweet_created_at
    ? formatDistanceToNow(new Date(opportunity.tweet_created_at), { addSuffix: true, locale: ptBR })
    : '';

  return (
    <div
      className={cn(
        "p-3 cursor-pointer transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
        opportunity.status === 'replied' && "opacity-60"
      )}
      onClick={onSelect}
    >
      <div className="flex gap-3">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={opportunity.author_avatar || undefined} />
          <AvatarFallback className="text-xs bg-primary/10 text-primary">
            {opportunity.author_username?.charAt(0)?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium truncate">{opportunity.author_name}</span>
            <span className="text-xs text-muted-foreground">@{opportunity.author_username}</span>
            {opportunity.author_followers && opportunity.author_followers > 1000 && (
              <span className="text-[10px] text-muted-foreground">
                {(opportunity.author_followers / 1000).toFixed(1)}K
              </span>
            )}
          </div>

          <p className="text-sm text-foreground leading-relaxed line-clamp-3 mb-2">
            {opportunity.tweet_text}
          </p>

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            {metrics.like_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {metrics.like_count}
              </span>
            )}
            {metrics.retweet_count > 0 && (
              <span className="flex items-center gap-1">
                <Repeat2 className="h-3 w-3" /> {metrics.retweet_count}
              </span>
            )}
            {metrics.reply_count > 0 && (
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {metrics.reply_count}
              </span>
            )}
            <span>{timeAgo}</span>
            <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", cat.color)}>
              {cat.label}
            </span>
            {opportunity.status === 'replied' && (
              <span className="flex items-center gap-0.5 text-green-600">
                <CheckCircle className="h-3 w-3" /> Respondido
              </span>
            )}
            {opportunity.status === 'saved' && (
              <span className="flex items-center gap-0.5 text-blue-600">
                <Bookmark className="h-3 w-3" /> Salvo
              </span>
            )}

            <div className="flex-1" />

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onSave(); }}
            >
              <Bookmark className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

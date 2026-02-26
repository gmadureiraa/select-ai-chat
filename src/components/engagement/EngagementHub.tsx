import { useState } from "react";
import { useEngagementFeed, EngagementOpportunity } from "@/hooks/useEngagementFeed";
import { OpportunityFeed } from "./OpportunityFeed";
import { ReplyPanel } from "./ReplyPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Search, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EngagementHubProps {
  clientId: string;
}

export function EngagementHub({ clientId }: EngagementHubProps) {
  const feed = useEngagementFeed(clientId);
  const [selectedOpportunity, setSelectedOpportunity] = useState<EngagementOpportunity | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const handleRefresh = () => {
    feed.refreshFeed.mutate({ query: searchQuery || undefined });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Engajamento</h2>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {feed.opportunities.length} oportunidades
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={feed.refreshFeed.isPending}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1", feed.refreshFeed.isPending && "animate-spin")} />
            Buscar
          </Button>
        </div>

        {/* Search */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por tópico, hashtag ou @usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-1">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'networking', label: '🤝 Networking' },
            { value: 'community', label: '👥 Comunidade' },
            { value: 'growth', label: '📈 Crescimento' },
          ].map((cat) => (
            <Button
              key={cat.value}
              variant={feed.categoryFilter === cat.value ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => feed.setCategoryFilter(cat.value)}
            >
              {cat.label}
            </Button>
          ))}
          <div className="flex-1" />
          {[
            { value: 'active', label: 'Ativos' },
            { value: 'replied', label: 'Respondidos' },
            { value: 'all', label: 'Todos' },
          ].map((st) => (
            <Button
              key={`status-${st.value}`}
              variant={feed.statusFilter === st.value ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => feed.setStatusFilter(st.value)}
            >
              {st.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={cn(
          "flex-1 overflow-y-auto",
          selectedOpportunity && "border-r border-border"
        )}>
          <OpportunityFeed
            opportunities={feed.opportunities}
            isLoading={feed.isLoading}
            selectedId={selectedOpportunity?.id}
            onSelect={setSelectedOpportunity}
            onDismiss={(id) => feed.updateStatus.mutate({ id, status: 'dismissed' })}
            onSave={(id) => feed.updateStatus.mutate({ id, status: 'saved' })}
          />
        </div>

        {selectedOpportunity && (
          <div className="w-[400px] flex-shrink-0 overflow-y-auto">
            <ReplyPanel
              opportunity={selectedOpportunity}
              clientId={clientId}
              onClose={() => setSelectedOpportunity(null)}
              onReplyGenerated={(text) => {
                // Update local state
              }}
              onReplyPosted={() => {
                setSelectedOpportunity(null);
                feed.refetch();
              }}
              generateReply={feed.generateReply}
              postReply={feed.postReply}
            />
          </div>
        )}
      </div>
    </div>
  );
}

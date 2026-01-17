import { useState, useMemo } from "react";
import { Instagram, Twitter, Linkedin, FileText, Search, Filter, Loader2, Star } from "lucide-react";
import { useUnifiedContent, useToggleFavorite, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { ContentCard } from "./ContentCard";
import { ContentPreviewDialog } from "./ContentPreviewDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";

interface UnifiedContentGridProps {
  clientId: string;
  onSelectContent?: (item: UnifiedContentItem) => void;
  compact?: boolean;
  draggable?: boolean;
}

type PlatformFilter = 'all' | 'instagram' | 'twitter' | 'linkedin' | 'content' | 'favorites';

const platformFilters: { value: PlatformFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Todos', icon: Filter },
  { value: 'favorites', label: 'Favoritos', icon: Star },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'twitter', label: 'Twitter', icon: Twitter },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'content', label: 'Outros', icon: FileText },
];

export function UnifiedContentGrid({ clientId, onSelectContent, compact, draggable }: UnifiedContentGridProps) {
  const { data: content, isLoading } = useUnifiedContent(clientId);
  const toggleFavorite = useToggleFavorite(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<UnifiedContentItem | null>(null);

  const filteredContent = useMemo(() => {
    if (!content) return [];
    
    return content.filter((item) => {
      // Favorites filter
      if (platformFilter === 'favorites') {
        if (!item.is_favorite) return false;
      } else if (platformFilter !== 'all' && item.platform !== platformFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.title.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query)
        );
      }
      
      return true;
    });
  }, [content, platformFilter, searchQuery]);

  const platformCounts = useMemo(() => {
    if (!content) return { favorites: 0 };
    const counts = content.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      if (item.is_favorite) acc.favorites = (acc.favorites || 0) + 1;
      return acc;
    }, { favorites: 0 } as Record<string, number>);
    return counts;
  }, [content]);

  const handleCardClick = (item: UnifiedContentItem) => {
    setPreviewItem(item); // Opens the preview dialog
    setSelectedId(item.id);
    onSelectContent?.(item);
  };

  const handleDragStart = (e: React.DragEvent, item: UnifiedContentItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!content?.length) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p className="text-sm">Nenhum conteúdo sincronizado</p>
        <p className="text-xs mt-1">Importe dados do Instagram, Twitter ou LinkedIn</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar conteúdo..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Platform filters */}
      <div className="flex flex-wrap gap-2">
        {platformFilters.map((filter) => {
          const Icon = filter.icon;
          const count = filter.value === 'all' 
            ? content.length 
            : platformCounts[filter.value] || 0;
          
          return (
            <Button
              key={filter.value}
              variant={platformFilter === filter.value ? "default" : "outline"}
              size="sm"
              onClick={() => setPlatformFilter(filter.value)}
              className={cn("h-8 text-xs", filter.value === 'favorites' && "border-yellow-400/50")}
            >
              <Icon className={cn("h-3 w-3 mr-1", filter.value === 'favorites' && platformFilter === filter.value && "fill-yellow-400")} />
              {filter.label}
              <Badge 
                variant="secondary" 
                className={cn(
                  "ml-1.5 h-4 px-1 text-[10px]",
                  platformFilter === filter.value && "bg-primary-foreground/20"
                )}
              >
                {count}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        {compact ? (
          <div className="space-y-2">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                draggable={draggable}
                onDragStart={(e) => handleDragStart(e, item)}
              >
                <ContentCard
                  item={item}
                  compact
                  selected={selectedId === item.id}
                  onSelect={() => handleCardClick(item)}
                  onPreview={() => setPreviewItem(item)}
                  onToggleFavorite={() => toggleFavorite.mutate({ item })}
                  draggable={draggable}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredContent.map((item) => (
              <div
                key={item.id}
                draggable={draggable}
                onDragStart={(e) => handleDragStart(e, item)}
              >
                <ContentCard
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => handleCardClick(item)}
                  onPreview={() => setPreviewItem(item)}
                  onToggleFavorite={() => toggleFavorite.mutate({ item })}
                  draggable={draggable}
                />
              </div>
            ))}
          </div>
        )}

        {filteredContent.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum resultado encontrado</p>
          </div>
        )}
      </div>

      {/* Preview Dialog */}
      <ContentPreviewDialog
        item={previewItem}
        open={!!previewItem}
        onOpenChange={(open) => !open && setPreviewItem(null)}
        onToggleFavorite={() => previewItem && toggleFavorite.mutate({ item: previewItem })}
        onAddToCanvas={() => previewItem && handleCardClick(previewItem)}
      />
    </div>
  );
}

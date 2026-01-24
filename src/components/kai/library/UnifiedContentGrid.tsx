import { useState, useMemo } from "react";
import { Instagram, MessageSquare, Linkedin, Youtube, FileText, Search, Loader2, Star, Mail } from "lucide-react";
import { useUnifiedContent, useToggleFavorite, useUpdateUnifiedContent, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { ContentCard } from "./ContentCard";
import { ContentPreviewDialog } from "./ContentPreviewDialog";
import { ContentEditDialog } from "./ContentEditDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContentTypeFilter, SortOption, ViewMode } from "@/components/kai/LibraryFilters";

interface UnifiedContentGridProps {
  clientId: string;
  onSelectContent?: (item: UnifiedContentItem) => void;
  compact?: boolean;
  draggable?: boolean;
  // External filter props
  typeFilter?: ContentTypeFilter;
  sortOption?: SortOption;
  viewMode?: ViewMode;
  searchQuery?: string;
}

type PlatformFilter = 'all' | 'instagram' | 'twitter' | 'linkedin' | 'youtube' | 'newsletter' | 'content' | 'favorites';

const platformFilters: { value: PlatformFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Todos', icon: FileText },
  { value: 'favorites', label: 'Favoritos', icon: Star },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'twitter', label: 'Twitter', icon: MessageSquare },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'newsletter', label: 'Newsletter', icon: Mail },
  { value: 'content', label: 'Outros', icon: FileText },
];

// Map content type filter to platform
const typeFilterToPlatform: Record<ContentTypeFilter, PlatformFilter | null> = {
  all: null,
  carousel: 'instagram',
  newsletter: 'newsletter',
  tweet: 'twitter',
  thread: 'twitter',
  linkedin_post: 'linkedin',
  stories: 'instagram',
  short_video: 'youtube',
  long_video: 'youtube',
  static_image: 'instagram',
  blog_post: 'content',
  case_study: 'content',
  report: 'content',
  document: 'content',
};

export function UnifiedContentGrid({ 
  clientId, 
  onSelectContent, 
  compact, 
  draggable,
  typeFilter: externalTypeFilter,
  sortOption: externalSortOption,
  viewMode: externalViewMode,
  searchQuery: externalSearchQuery
}: UnifiedContentGridProps) {
  const { data: content, isLoading } = useUnifiedContent(clientId);
  const toggleFavorite = useToggleFavorite(clientId);
  const updateContent = useUpdateUnifiedContent(clientId);
  
  // Local state (used when external filters not provided)
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<UnifiedContentItem | null>(null);
  const [editItem, setEditItem] = useState<UnifiedContentItem | null>(null);

  // Use external or local values
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : localSearchQuery;
  const useExternalFilters = externalTypeFilter !== undefined;
  const viewMode = externalViewMode || 'grid';

  const filteredContent = useMemo(() => {
    if (!content) return [];
    
    let filtered = content.filter((item) => {
      // External type filter takes precedence
      if (useExternalFilters && externalTypeFilter && externalTypeFilter !== 'all') {
        const targetPlatform = typeFilterToPlatform[externalTypeFilter];
        if (targetPlatform && item.platform !== targetPlatform) {
          return false;
        }
        // Also filter by content_type if available
        if (item.content_type && item.content_type !== externalTypeFilter) {
          // For some types, we want to match platform instead
          const platformTypes = ['carousel', 'stories', 'static_image', 'instagram_post'];
          if (!platformTypes.includes(externalTypeFilter) || item.platform !== 'instagram') {
            return false;
          }
        }
      } else {
        // Use local platform filter
        if (platformFilter === 'favorites') {
          if (!item.is_favorite) return false;
        } else if (platformFilter !== 'all' && item.platform !== platformFilter) {
          return false;
        }
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

    // Apply external sort option
    if (externalSortOption) {
      filtered = [...filtered].sort((a, b) => {
        switch (externalSortOption) {
          case 'newest':
            return new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime();
          case 'oldest':
            return new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime();
          case 'a-z':
            return a.title.localeCompare(b.title);
          case 'z-a':
            return b.title.localeCompare(a.title);
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [content, platformFilter, searchQuery, externalTypeFilter, externalSortOption, useExternalFilters]);

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
    setPreviewItem(item);
    setSelectedId(item.id);
    onSelectContent?.(item);
  };

  const handleDragStart = (e: React.DragEvent, item: UnifiedContentItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleEditSave = async (data: { title?: string; content?: string; content_url?: string }) => {
    if (!editItem) return;
    await updateContent.mutateAsync({ item: editItem, data });
    setEditItem(null);
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
        <p className="text-xs mt-1">Importe dados do Instagram, YouTube, Twitter ou LinkedIn</p>
      </div>
    );
  }

  // Determine if we should use compact or grid based on viewMode
  const useCompactView = compact || viewMode === 'list';

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Search - only show if no external search query */}
      {externalSearchQuery === undefined && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conteúdo..."
            value={localSearchQuery}
            onChange={(e) => setLocalSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Platform filters - only show if no external type filter */}
      {!useExternalFilters && (
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
      )}

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto pr-2">
        {useCompactView ? (
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
        onEdit={() => {
          if (previewItem) {
            setEditItem(previewItem);
            setPreviewItem(null);
          }
        }}
      />

      {/* Edit Dialog */}
      <ContentEditDialog
        item={editItem}
        open={!!editItem}
        onOpenChange={(open) => !open && setEditItem(null)}
        onSave={handleEditSave}
        isLoading={updateContent.isPending}
      />
    </div>
  );
}

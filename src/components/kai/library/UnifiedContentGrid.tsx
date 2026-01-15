import { useState, useMemo } from "react";
import { Instagram, Twitter, Linkedin, FileText, Search, Filter, Loader2 } from "lucide-react";
import { useUnifiedContent, UnifiedContentItem } from "@/hooks/useUnifiedContent";
import { ContentCard } from "./ContentCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface UnifiedContentGridProps {
  clientId: string;
  onSelectContent?: (item: UnifiedContentItem) => void;
  compact?: boolean;
  maxHeight?: string;
}

type PlatformFilter = 'all' | 'instagram' | 'twitter' | 'linkedin' | 'content';

const platformFilters: { value: PlatformFilter; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'Todos', icon: Filter },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'twitter', label: 'Twitter', icon: Twitter },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'content', label: 'Outros', icon: FileText },
];

export function UnifiedContentGrid({ clientId, onSelectContent, compact, maxHeight = "calc(100vh - 300px)" }: UnifiedContentGridProps) {
  const { data: content, isLoading } = useUnifiedContent(clientId);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filteredContent = useMemo(() => {
    if (!content) return [];
    
    return content.filter((item) => {
      // Platform filter
      if (platformFilter !== 'all' && item.platform !== platformFilter) {
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
    if (!content) return {};
    return content.reduce((acc, item) => {
      acc[item.platform] = (acc[item.platform] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [content]);

  const handleSelect = (item: UnifiedContentItem) => {
    setSelectedId(item.id);
    onSelectContent?.(item);
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
    <div className="space-y-4">
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
              className="h-8 text-xs"
            >
              <Icon className="h-3 w-3 mr-1" />
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
      <ScrollArea style={{ maxHeight }} className="pr-4">
        {compact ? (
          <div className="space-y-2">
            {filteredContent.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                compact
                selected={selectedId === item.id}
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredContent.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                selected={selectedId === item.id}
                onSelect={() => handleSelect(item)}
              />
            ))}
          </div>
        )}

        {filteredContent.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Nenhum resultado encontrado</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

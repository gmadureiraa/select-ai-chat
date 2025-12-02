import { useState, useCallback } from "react";
import { 
  Search, 
  ImageIcon, 
  FileText, 
  Youtube, 
  Link as LinkIcon,
  Sparkles,
  X,
  Filter,
  Loader2
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ResearchItem } from "@/hooks/useResearchItems";

interface VisualSearchPanelProps {
  items: ResearchItem[];
  onSearch: (query: string) => void;
  onFilterChange: (types: string[]) => void;
  onItemClick: (item: ResearchItem) => void;
  searchQuery: string;
  activeFilters: string[];
}

const typeIcons: Record<string, any> = {
  youtube: Youtube,
  image: ImageIcon,
  pdf: FileText,
  link: LinkIcon,
  text: FileText,
  note: FileText,
  ai_chat: Sparkles,
};

const typeColors: Record<string, string> = {
  youtube: "bg-red-500",
  image: "bg-orange-500",
  pdf: "bg-rose-500",
  link: "bg-green-500",
  text: "bg-blue-500",
  note: "bg-yellow-500",
  ai_chat: "bg-purple-500",
  audio: "bg-pink-500",
  content_library: "bg-cyan-500",
  reference_library: "bg-indigo-500",
};

export const VisualSearchPanel = ({ 
  items, 
  onSearch, 
  onFilterChange,
  onItemClick,
  searchQuery,
  activeFilters
}: VisualSearchPanelProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = useCallback((value: string) => {
    setLocalQuery(value);
    setIsSearching(true);
    
    // Debounce search
    const timer = setTimeout(() => {
      onSearch(value);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [onSearch]);

  const filteredItems = items.filter(item => {
    const matchesQuery = !localQuery || 
      item.title?.toLowerCase().includes(localQuery.toLowerCase()) ||
      item.content?.toLowerCase().includes(localQuery.toLowerCase());
    
    const matchesType = activeFilters.length === 0 || activeFilters.includes(item.type);
    
    return matchesQuery && matchesType;
  });

  const groupedItems = filteredItems.reduce((acc, item) => {
    const type = item.type;
    if (!acc[type]) acc[type] = [];
    acc[type].push(item);
    return acc;
  }, {} as Record<string, ResearchItem[]>);

  return (
    <div className="absolute top-4 left-4 z-50">
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conteúdo..."
                value={localQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => setIsExpanded(true)}
                className="pl-9 pr-10 w-72 h-10 bg-card/95 backdrop-blur-sm border-border rounded-xl shadow-lg"
              />
              {localQuery && (
                <button
                  onClick={() => {
                    setLocalQuery("");
                    onSearch("");
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Search Header */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar em textos, imagens, vídeos..."
                  value={localQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-10 bg-muted/50 border-0 focus-visible:ring-1"
                  autoFocus
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              
              {/* Quick Filters */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {Object.keys(typeColors).slice(0, 6).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      const newFilters = activeFilters.includes(type)
                        ? activeFilters.filter(f => f !== type)
                        : [...activeFilters, type];
                      onFilterChange(newFilters);
                    }}
                    className={cn(
                      "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all",
                      activeFilters.includes(type)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    )}
                  >
                    <div className={cn("w-1.5 h-1.5 rounded-full", typeColors[type])} />
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            {/* Results */}
            <ScrollArea className="h-80">
              <div className="p-2">
                {Object.entries(groupedItems).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">
                      {localQuery ? "Nenhum resultado encontrado" : "Digite para buscar"}
                    </p>
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([type, typeItems]) => (
                    <div key={type} className="mb-4">
                      <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase">
                        <div className={cn("w-2 h-2 rounded-full", typeColors[type])} />
                        {type.replace("_", " ")} ({typeItems.length})
                      </div>
                      <div className="space-y-1">
                        {typeItems.slice(0, 5).map((item) => {
                          const Icon = typeIcons[item.type] || FileText;
                          return (
                            <button
                              key={item.id}
                              onClick={() => {
                                onItemClick(item);
                                setIsExpanded(false);
                              }}
                              className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors text-left group"
                            >
                              {item.thumbnail_url ? (
                                <img 
                                  src={item.thumbnail_url} 
                                  alt="" 
                                  className="w-12 h-12 rounded-lg object-cover bg-muted"
                                />
                              ) : (
                                <div className={cn(
                                  "w-12 h-12 rounded-lg flex items-center justify-center",
                                  "bg-muted"
                                )}>
                                  <Icon className="h-5 w-5 text-muted-foreground" />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                                  {item.title || "Sem título"}
                                </p>
                                {item.content && (
                                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                    {item.content.slice(0, 100)}
                                  </p>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {filteredItems.length} de {items.length} itens
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsExpanded(false)}
              >
                Fechar
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

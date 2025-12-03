import { useState } from "react";
import { Search, Filter, X, Tag, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { RESEARCH_CATEGORIES } from "@/types/researchCategories";

interface SearchFilterPanelProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: FilterState) => void;
  itemCount: number;
  filteredCount: number;
}

export interface FilterState {
  types: string[];
  tags: string[];
  categories: string[];
  processed: "all" | "processed" | "pending";
}

const itemTypes = [
  { id: "ai_chat", label: "Chat IA", color: "bg-purple-500" },
  { id: "comparison", label: "Comparação", color: "bg-amber-500" },
  { id: "note", label: "Nota", color: "bg-yellow-500" },
  { id: "text", label: "Texto", color: "bg-blue-500" },
  { id: "youtube", label: "YouTube", color: "bg-red-500" },
  { id: "link", label: "Link", color: "bg-green-500" },
  { id: "pdf", label: "PDF", color: "bg-rose-500" },
  { id: "embed", label: "Embed", color: "bg-emerald-500" },
  { id: "spreadsheet", label: "Planilha", color: "bg-teal-500" },
  { id: "audio", label: "Áudio", color: "bg-pink-500" },
  { id: "image", label: "Imagem", color: "bg-orange-500" },
  { id: "content_library", label: "Biblioteca Conteúdo", color: "bg-cyan-500" },
  { id: "reference_library", label: "Biblioteca Referências", color: "bg-indigo-500" },
  { id: "group", label: "Grupo", color: "bg-slate-500" },
];

export const SearchFilterPanel = ({ 
  onSearch, 
  onFilterChange, 
  itemCount, 
  filteredCount 
}: SearchFilterPanelProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>({
    types: [],
    tags: [],
    categories: [],
    processed: "all",
  });
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch(value);
  };

  const toggleTypeFilter = (typeId: string) => {
    const newTypes = filters.types.includes(typeId)
      ? filters.types.filter(t => t !== typeId)
      : [...filters.types, typeId];
    
    const newFilters = { ...filters, types: newTypes };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const toggleCategoryFilter = (categoryId: string) => {
    const newCategories = filters.categories.includes(categoryId)
      ? filters.categories.filter(c => c !== categoryId)
      : [...filters.categories, categoryId];
    
    const newFilters = { ...filters, categories: newCategories };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = { types: [], tags: [], categories: [], processed: "all" };
    setFilters(emptyFilters);
    setSearchQuery("");
    onSearch("");
    onFilterChange(emptyFilters);
  };

  const hasActiveFilters = filters.types.length > 0 || filters.categories.length > 0 || filters.tags.length > 0 || filters.processed !== "all" || searchQuery;
  const activeFilterCount = filters.types.length + filters.categories.length;

  return (
    <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no canvas..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9 pr-8 w-64 h-9 bg-card/95 backdrop-blur-sm border-border"
        />
        {searchQuery && (
          <button
            onClick={() => handleSearchChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter Button */}
      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 bg-card/95 backdrop-blur-sm",
              hasActiveFilters && "border-primary text-primary"
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-sm">Filtros</h4>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={clearFilters}
                >
                  Limpar
                </Button>
              )}
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Por Categoria</h5>
              <div className="grid grid-cols-2 gap-1.5">
                {RESEARCH_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  return (
                    <div
                      key={category.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                        filters.categories.includes(category.id)
                          ? cn("border-primary", category.bgClass)
                          : "border-border hover:border-muted-foreground/50"
                      )}
                      onClick={() => toggleCategoryFilter(category.id)}
                    >
                      <Icon className={cn("h-3 w-3", category.textClass)} />
                      <span className="text-xs truncate">{category.label.split('/')[0]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Type Filter */}
            <div className="space-y-2">
              <h5 className="text-xs font-medium text-muted-foreground">Por Tipo</h5>
              <div className="grid grid-cols-2 gap-1.5">
                {itemTypes.map((type) => (
                  <div
                    key={type.id}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all",
                      filters.types.includes(type.id)
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                    onClick={() => toggleTypeFilter(type.id)}
                  >
                    <div className={cn("w-2 h-2 rounded-full", type.color)} />
                    <span className="text-xs">{type.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Mostrando {filteredCount} de {itemCount} itens
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {(filters.types.length > 0 || filters.categories.length > 0) && (
        <div className="flex gap-1 flex-wrap max-w-xs">
          {filters.categories.slice(0, 2).map((catId) => {
            const category = RESEARCH_CATEGORIES.find(c => c.id === catId);
            if (!category) return null;
            const Icon = category.icon;
            return (
              <Badge
                key={catId}
                variant="secondary"
                className={cn("h-7 gap-1 cursor-pointer hover:bg-destructive/20", category.bgClass, category.textClass)}
                onClick={() => toggleCategoryFilter(catId)}
              >
                <Icon className="h-3 w-3" />
                {category.label.split('/')[0]}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {filters.types.slice(0, 2).map((typeId) => {
            const type = itemTypes.find(t => t.id === typeId);
            return (
              <Badge
                key={typeId}
                variant="secondary"
                className="h-7 gap-1 cursor-pointer hover:bg-destructive/20"
                onClick={() => toggleTypeFilter(typeId)}
              >
                <div className={cn("w-2 h-2 rounded-full", type?.color)} />
                {type?.label}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {(filters.types.length + filters.categories.length) > 4 && (
            <Badge variant="secondary" className="h-7">
              +{(filters.types.length + filters.categories.length) - 4}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
};

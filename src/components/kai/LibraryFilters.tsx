import { useState } from "react";
import { Filter, SortAsc, Grid, List, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

export type ContentTypeFilter = 
  | "all"
  | "carousel"
  | "newsletter"
  | "tweet"
  | "thread"
  | "linkedin_post"
  | "stories"
  | "short_video"
  | "long_video"
  | "static_image"
  | "blog_post"
  | "case_study"
  | "report"
  | "document";

export type SortOption = "newest" | "oldest" | "a-z" | "z-a";
export type ViewMode = "grid" | "list";

interface LibraryFiltersProps {
  typeFilter: ContentTypeFilter;
  onTypeFilterChange: (type: ContentTypeFilter) => void;
  sortOption: SortOption;
  onSortChange: (sort: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedCount?: number;
  onClearSelection?: () => void;
  onDeleteSelected?: () => void;
  canDelete?: boolean;
}

const contentTypeLabels: Record<ContentTypeFilter, string> = {
  all: "Todos",
  carousel: "Carrossel",
  newsletter: "Newsletter",
  tweet: "Tweet",
  thread: "Thread",
  linkedin_post: "LinkedIn",
  stories: "Stories",
  short_video: "Vídeo Curto",
  long_video: "Vídeo Longo",
  static_image: "Imagem",
  blog_post: "Blog Post",
  case_study: "Estudo de Caso",
  report: "Relatório",
  document: "Documento",
};

const sortLabels: Record<SortOption, string> = {
  newest: "Mais recentes",
  oldest: "Mais antigos",
  "a-z": "A-Z",
  "z-a": "Z-A",
};

export const LibraryFilters = ({
  typeFilter,
  onTypeFilterChange,
  sortOption,
  onSortChange,
  viewMode,
  onViewModeChange,
  selectedCount = 0,
  onClearSelection,
  onDeleteSelected,
  canDelete = true,
}: LibraryFiltersProps) => {
  const hasActiveFilter = typeFilter !== "all";

  return (
    <div className="flex items-center gap-2">
      {/* Bulk Actions */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg border border-primary/20">
          <span className="text-xs font-medium text-primary">
            {selectedCount} selecionado{selectedCount > 1 ? "s" : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={onClearSelection}
          >
            <X className="h-3 w-3 mr-1" />
            Limpar
          </Button>
          {canDelete && (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={onDeleteSelected}
            >
              Excluir
            </Button>
          )}
        </div>
      )}

      {/* Type Filter */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tipo</span>
            {hasActiveFilter && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {contentTypeLabels[typeFilter]}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">Filtrar por tipo</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(contentTypeLabels).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => onTypeFilterChange(key as ContentTypeFilter)}
              className="flex items-center justify-between"
            >
              {label}
              {typeFilter === key && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <SortAsc className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{sortLabels[sortOption]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {Object.entries(sortLabels).map(([key, label]) => (
            <DropdownMenuItem
              key={key}
              onClick={() => onSortChange(key as SortOption)}
              className="flex items-center justify-between"
            >
              {label}
              {sortOption === key && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Mode Toggle */}
      <div className="flex items-center border rounded-md">
        <Toggle
          pressed={viewMode === "grid"}
          onPressedChange={() => onViewModeChange("grid")}
          size="sm"
          className={cn(
            "h-8 w-8 rounded-r-none border-0",
            viewMode === "grid" && "bg-muted"
          )}
        >
          <Grid className="h-3.5 w-3.5" />
        </Toggle>
        <Toggle
          pressed={viewMode === "list"}
          onPressedChange={() => onViewModeChange("list")}
          size="sm"
          className={cn(
            "h-8 w-8 rounded-l-none border-0",
            viewMode === "list" && "bg-muted"
          )}
        >
          <List className="h-3.5 w-3.5" />
        </Toggle>
      </div>
    </div>
  );
};

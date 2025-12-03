import { memo } from "react";
import { Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { RESEARCH_CATEGORIES, getCategoryById } from "@/types/researchCategories";

interface CategorySelectorProps {
  categoryId?: string;
  onCategoryChange: (categoryId: string | undefined) => void;
  size?: "sm" | "md";
}

export const CategorySelector = memo(({ categoryId, onCategoryChange, size = "sm" }: CategorySelectorProps) => {
  const currentCategory = getCategoryById(categoryId);
  const buttonSize = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={cn(
            buttonSize,
            currentCategory && cn(currentCategory.bgClass, currentCategory.textClass, "hover:opacity-80")
          )}
          title="Definir categoria"
        >
          {currentCategory ? (
            <currentCategory.icon className={iconSize} />
          ) : (
            <Tag className={cn(iconSize, "text-muted-foreground")} />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="bottom">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            Categoria do item
          </p>
          
          {categoryId && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs h-8 text-muted-foreground"
              onClick={() => onCategoryChange(undefined)}
            >
              <X className="h-3 w-3 mr-2" />
              Remover categoria
            </Button>
          )}

          <div className="grid gap-1">
            {RESEARCH_CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = categoryId === category.id;
              
              return (
                <button
                  key={category.id}
                  className={cn(
                    "flex items-start gap-3 p-2 rounded-md text-left transition-colors",
                    "hover:bg-muted/50",
                    isSelected && cn(category.bgClass, "ring-1", category.borderClass)
                  )}
                  onClick={() => onCategoryChange(category.id)}
                >
                  <div className={cn("p-1.5 rounded-md", category.bgClass)}>
                    <Icon className={cn("h-4 w-4", category.textClass)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", isSelected && category.textClass)}>
                      {category.label}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {category.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
});

CategorySelector.displayName = "CategorySelector";

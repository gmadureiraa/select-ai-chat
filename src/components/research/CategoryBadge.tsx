import { memo } from "react";
import { cn } from "@/lib/utils";
import { getCategoryById, ResearchCategory } from "@/types/researchCategories";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface CategoryBadgeProps {
  categoryId?: string;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export const CategoryBadge = memo(({ categoryId, size = "sm", showLabel = false }: CategoryBadgeProps) => {
  const category = getCategoryById(categoryId);
  
  if (!category) return null;

  const Icon = category.icon;
  const iconSize = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const badgeSize = size === "sm" ? "px-1.5 py-0.5" : "px-2 py-1";

  const badge = (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-xs font-medium",
        badgeSize,
        category.bgClass,
        category.textClass
      )}
    >
      <Icon className={iconSize} />
      {showLabel && <span className="truncate max-w-[100px]">{category.label}</span>}
    </div>
  );

  if (showLabel) return badge;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-medium">{category.label}</p>
          <p className="text-xs text-muted-foreground">{category.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

CategoryBadge.displayName = "CategoryBadge";

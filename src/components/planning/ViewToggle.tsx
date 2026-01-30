import { LayoutGrid, Calendar, List } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type PlanningView = 'board' | 'calendar' | 'list';

interface ViewToggleProps {
  view: PlanningView;
  onChange: (view: PlanningView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={view} 
      onValueChange={(v) => v && onChange(v as PlanningView)}
      className="gap-0 bg-muted/40 rounded-lg p-0.5"
    >
      <ToggleGroupItem 
        value="board" 
        aria-label="Board view" 
        className={cn(
          "gap-1 px-2 h-7 text-xs rounded-md",
          "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
          "data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:bg-transparent",
          "transition-all duration-150"
        )}
      >
        <LayoutGrid className="h-3 w-3" />
        <span className="hidden sm:inline">Board</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="calendar" 
        aria-label="Calendar view" 
        className={cn(
          "gap-1 px-2 h-7 text-xs rounded-md",
          "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
          "data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:bg-transparent",
          "transition-all duration-150"
        )}
      >
        <Calendar className="h-3 w-3" />
        <span className="hidden sm:inline">Calendário</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="list" 
        aria-label="List view" 
        className={cn(
          "gap-1 px-2 h-7 text-xs rounded-md",
          "data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm",
          "data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground data-[state=off]:bg-transparent",
          "transition-all duration-150"
        )}
      >
        <List className="h-3 w-3" />
        <span className="hidden sm:inline">Lista</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

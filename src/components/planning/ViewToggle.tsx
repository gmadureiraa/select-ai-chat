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
      className="bg-muted/30 p-0.5 rounded-lg border border-border/50"
    >
      <ToggleGroupItem 
        value="board" 
        aria-label="Board view" 
        className={cn(
          "gap-1.5 px-3 h-7 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm",
          "transition-all duration-150"
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Board</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="calendar" 
        aria-label="Calendar view" 
        className={cn(
          "gap-1.5 px-3 h-7 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm",
          "transition-all duration-150"
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Calendário</span>
      </ToggleGroupItem>
      <ToggleGroupItem 
        value="list" 
        aria-label="List view" 
        className={cn(
          "gap-1.5 px-3 h-7 text-xs rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm",
          "transition-all duration-150"
        )}
      >
        <List className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Lista</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

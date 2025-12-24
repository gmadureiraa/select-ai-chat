import { LayoutGrid, Calendar, List } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

export type PlanningView = 'board' | 'calendar' | 'list';

interface ViewToggleProps {
  view: PlanningView;
  onChange: (view: PlanningView) => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <ToggleGroup type="single" value={view} onValueChange={(v) => v && onChange(v as PlanningView)}>
      <ToggleGroupItem value="board" aria-label="Board view" className="gap-1.5 px-3">
        <LayoutGrid className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">Board</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="calendar" aria-label="Calendar view" className="gap-1.5 px-3">
        <Calendar className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">Calendário</span>
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view" className="gap-1.5 px-3">
        <List className="h-4 w-4" />
        <span className="hidden sm:inline text-sm">Lista</span>
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

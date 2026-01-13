import { memo } from 'react';
import { Plus, Lightbulb, FileEdit, Eye, ThumbsUp, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './PlanningItemCard';
import type { PlanningItem, KanbanColumn } from '@/hooks/usePlanningItems';

const columnConfig: Record<string, { 
  color: string; 
  icon: React.ElementType; 
  bgHover: string;
  dotColor: string;
  headerBg: string;
}> = {
  idea: { 
    color: 'text-purple-600 dark:text-purple-400', 
    icon: Lightbulb, 
    bgHover: 'hover:bg-purple-50/50 dark:hover:bg-purple-950/20',
    dotColor: 'bg-purple-500',
    headerBg: 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800',
  },
  draft: { 
    color: 'text-blue-600 dark:text-blue-400', 
    icon: FileEdit, 
    bgHover: 'hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
    dotColor: 'bg-blue-500',
    headerBg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  },
  review: { 
    color: 'text-amber-600 dark:text-amber-400', 
    icon: Eye, 
    bgHover: 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20',
    dotColor: 'bg-amber-500',
    headerBg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  approved: { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    icon: ThumbsUp, 
    bgHover: 'hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20',
    dotColor: 'bg-emerald-500',
    headerBg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  scheduled: { 
    color: 'text-orange-600 dark:text-orange-400', 
    icon: CalendarClock, 
    bgHover: 'hover:bg-orange-50/50 dark:hover:bg-orange-950/20',
    dotColor: 'bg-orange-500',
    headerBg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
  },
  published: { 
    color: 'text-slate-600 dark:text-slate-400', 
    icon: CheckCircle2, 
    bgHover: 'hover:bg-slate-50/50 dark:hover:bg-slate-950/20',
    dotColor: 'bg-slate-500',
    headerBg: 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800',
  },
};

interface VirtualizedKanbanColumnProps {
  column: KanbanColumn;
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (item: PlanningItem) => void;
  onAddCard: (columnId: string) => void;
  canDelete?: boolean;
  isDropTarget: boolean;
  draggedItemId: string | null;
  onDragStart: (e: React.DragEvent, item: PlanningItem) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, columnId: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, columnId: string) => void;
  height: number;
  className?: string;
}

export const VirtualizedKanbanColumn = memo(function VirtualizedKanbanColumn({
  column,
  items,
  onEditItem,
  onDeleteItem,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  onAddCard,
  canDelete = true,
  isDropTarget,
  draggedItemId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
  height,
  className,
}: VirtualizedKanbanColumnProps) {
  const config = columnConfig[column.column_type || ''] || columnConfig.idea;
  const ColumnIcon = config.icon;
  const failedCount = items.filter(i => i.status === 'failed').length;

  const listHeight = Math.max(200, height - 92);

  return (
    <div
      data-column-id={column.id}
      className={cn(
        "flex-shrink-0 bg-card/50 rounded-xl border border-border/50 flex flex-col",
        "transition-all duration-300 backdrop-blur-sm hover:shadow-lg",
        !className && "w-80",
        className,
        isDropTarget && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background bg-primary/5 scale-[1.02] shadow-xl"
      )}
      style={{ maxHeight: height }}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className={cn(
        "px-4 py-3 rounded-t-xl border-b flex-shrink-0",
        config.headerBg
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", config.dotColor)} />
            <span className={cn("font-semibold text-sm", config.color)}>{column.name}</span>
            <span className="text-xs text-muted-foreground bg-muted/80 px-2 py-0.5 rounded-full font-medium">
              {items.length}
            </span>
            {failedCount > 0 && (
              <Badge 
                variant="destructive" 
                className="text-[10px] font-medium px-1.5 py-0 h-4"
              >
                {failedCount}
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onAddCard(column.id)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0">
        {items.length === 0 ? (
          <div className={cn(
            "text-center py-8 mx-4 my-4 text-muted-foreground",
            "border border-dashed rounded-lg",
            isDropTarget && "border-primary bg-primary/5"
          )}>
            <ColumnIcon className={cn("h-5 w-5 mx-auto mb-2 opacity-40", config.color)} />
            <p className="text-xs font-medium">
              {isDropTarget ? 'Solte aqui' : 'Vazio'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-3 overflow-y-auto" style={{ maxHeight: listHeight }}>
            {items.map(item => (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => onDragStart(e, item)}
                onDragEnd={onDragEnd}
                className={cn(
                  "cursor-grab active:cursor-grabbing",
                  "transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5",
                  draggedItemId === item.id && "scale-95 opacity-50 rotate-1"
                )}
              >
                <PlanningItemCard
                  item={item}
                  onEdit={onEditItem}
                  onDelete={onDeleteItem}
                  onMoveToLibrary={onMoveToLibrary}
                  onRetry={onRetry}
                  onDuplicate={onDuplicate}
                  isDragging={draggedItemId === item.id}
                  compact
                  canDelete={canDelete}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Add Footer */}
      <div className="p-1.5 border-t border-border/50 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-center text-xs text-muted-foreground h-7",
            config.bgHover
          )}
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>
    </div>
  );
});

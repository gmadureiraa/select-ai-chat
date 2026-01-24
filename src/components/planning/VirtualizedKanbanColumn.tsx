import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Lightbulb, FileEdit, Eye, ThumbsUp, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './PlanningItemCard';
import type { PlanningItem, KanbanColumn } from '@/hooks/usePlanningItems';

const columnConfig: Record<string, { 
  color: string; 
  icon: React.ElementType; 
  dotColor: string;
  headerBg: string;
}> = {
  idea: { 
    color: 'text-purple-600 dark:text-purple-400', 
    icon: Lightbulb, 
    dotColor: 'bg-purple-500',
    headerBg: 'bg-purple-50/80 dark:bg-purple-950/40',
  },
  draft: { 
    color: 'text-blue-600 dark:text-blue-400', 
    icon: FileEdit, 
    dotColor: 'bg-blue-500',
    headerBg: 'bg-blue-50/80 dark:bg-blue-950/40',
  },
  review: { 
    color: 'text-amber-600 dark:text-amber-400', 
    icon: Eye, 
    dotColor: 'bg-amber-500',
    headerBg: 'bg-amber-50/80 dark:bg-amber-950/40',
  },
  approved: { 
    color: 'text-emerald-600 dark:text-emerald-400', 
    icon: ThumbsUp, 
    dotColor: 'bg-emerald-500',
    headerBg: 'bg-emerald-50/80 dark:bg-emerald-950/40',
  },
  scheduled: { 
    color: 'text-orange-600 dark:text-orange-400', 
    icon: CalendarClock, 
    dotColor: 'bg-orange-500',
    headerBg: 'bg-orange-50/80 dark:bg-orange-950/40',
  },
  published: { 
    color: 'text-slate-600 dark:text-slate-400', 
    icon: CheckCircle2, 
    dotColor: 'bg-slate-500',
    headerBg: 'bg-slate-50/80 dark:bg-slate-950/40',
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

  const listHeight = Math.max(200, height - 80);
  
  // Scroll shadow state
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: false, bottom: false });
  
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      top: el.scrollTop > 8,
      bottom: el.scrollHeight - el.scrollTop - el.clientHeight > 8,
    });
  }, []);
  
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      handleScroll();
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [items.length, handleScroll]);

  return (
    <div
      data-column-id={column.id}
      className={cn(
        "flex-shrink-0 bg-card/40 backdrop-blur-sm rounded-xl border border-border/40 flex flex-col",
        "transition-all duration-200",
        !className && "w-72",
        className,
        isDropTarget && "ring-2 ring-primary/40 bg-primary/5 scale-[1.01] shadow-lg"
      )}
      style={{ maxHeight: height }}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header */}
      <div className={cn(
        "px-3 py-2.5 rounded-t-xl flex-shrink-0",
        config.headerBg
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", config.dotColor)} />
            <span className={cn("font-medium text-sm", config.color)}>{column.name}</span>
            <span className="text-[10px] text-muted-foreground bg-background/60 px-1.5 py-0.5 rounded-md font-medium tabular-nums">
              {items.length}
            </span>
            {failedCount > 0 && (
              <span className="text-[10px] text-red-600 bg-red-100 dark:bg-red-900/40 px-1.5 py-0.5 rounded-md font-medium">
                {failedCount} ⚠
              </span>
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
      <div className="flex-1 min-h-0 relative">
        {items.length === 0 ? (
          <div className={cn(
            "text-center py-8 mx-3 my-3 text-muted-foreground",
            "border border-dashed border-border/50 rounded-xl",
            "transition-all duration-200",
            isDropTarget && "border-primary/50 bg-primary/5 scale-[1.02]"
          )}>
            <ColumnIcon className={cn("h-5 w-5 mx-auto mb-2 opacity-40", config.color)} />
            <p className="text-xs font-medium">
              {isDropTarget ? 'Solte aqui' : 'Vazio'}
            </p>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              Arraste itens ou clique em +
            </p>
          </div>
        ) : (
          <>
            {/* Top scroll shadow */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-card/90 to-transparent z-10 pointer-events-none transition-opacity duration-200",
              scrollState.top ? "opacity-100" : "opacity-0"
            )} />
            
            <div 
              ref={scrollRef}
              className="p-2 space-y-2 overflow-y-auto scrollbar-thin" 
              style={{ maxHeight: listHeight }}
            >
              {items.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  onDragEnd={onDragEnd}
                  className={cn(
                    "cursor-grab active:cursor-grabbing",
                    "transition-all duration-200",
                    draggedItemId === item.id && "scale-95 opacity-40 rotate-1"
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
            
            {/* Bottom scroll shadow */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card/90 to-transparent z-10 pointer-events-none transition-opacity duration-200",
              scrollState.bottom ? "opacity-100" : "opacity-0"
            )} />
          </>
        )}
      </div>

      {/* Quick Add Footer */}
      <div className="p-1.5 border-t border-border/30 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-[11px] text-muted-foreground h-7 hover:text-foreground hover:bg-muted/50"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Adicionar
        </Button>
      </div>
    </div>
  );
});

import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './PlanningItemCard';
import type { PlanningItem, KanbanColumn } from '@/hooks/usePlanningItems';

const columnConfig: Record<string, { 
  dotColor: string;
}> = {
  idea: { dotColor: 'bg-purple-500' },
  draft: { dotColor: 'bg-blue-500' },
  review: { dotColor: 'bg-amber-500' },
  approved: { dotColor: 'bg-emerald-500' },
  scheduled: { dotColor: 'bg-orange-500' },
  published: { dotColor: 'bg-slate-400' },
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
  const failedCount = items.filter(i => i.status === 'failed').length;
  const listHeight = Math.max(200, height - 60);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: false, bottom: false });
  
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setScrollState({
      top: el.scrollTop > 4,
      bottom: el.scrollHeight - el.scrollTop - el.clientHeight > 4,
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
        "flex-shrink-0 bg-transparent rounded-lg flex flex-col",
        "transition-all duration-150",
        !className && "w-72",
        className,
        isDropTarget && "bg-primary/5"
      )}
      style={{ maxHeight: height }}
      onDragOver={(e) => onDragOver(e, column.id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, column.id)}
    >
      {/* Column Header - Linear style: minimal with dot */}
      <div className="px-2 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn("w-2 h-2 rounded-full", config.dotColor)} />
            <span className="font-medium text-sm text-foreground">{column.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {items.length}
            </span>
            {failedCount > 0 && (
              <span className="text-[10px] text-red-500 font-medium">
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
            "mx-2 py-8 text-center text-muted-foreground",
            "border border-dashed border-border/50 rounded-lg",
            "transition-colors duration-150",
            isDropTarget && "border-primary/50 bg-primary/5"
          )}>
            <p className="text-xs">
              {isDropTarget ? 'Solte aqui' : 'Vazio'}
            </p>
          </div>
        ) : (
          <>
            {/* Top fade */}
            <div className={cn(
              "absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity",
              scrollState.top ? "opacity-100" : "opacity-0"
            )} />
            
            <div 
              ref={scrollRef}
              className="px-1 pb-2 space-y-1.5 overflow-y-auto scrollbar-thin" 
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
                    "transition-all duration-150",
                    draggedItemId === item.id && "opacity-40 scale-[0.98]"
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
                    compact={false}
                    canDelete={canDelete}
                  />
                </div>
              ))}
            </div>
            
            {/* Bottom fade */}
            <div className={cn(
              "absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity",
              scrollState.bottom ? "opacity-100" : "opacity-0"
            )} />
          </>
        )}
      </div>

      {/* Quick Add - Minimal */}
      <div className="px-2 pb-2 flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs text-muted-foreground h-7 hover:text-foreground hover:bg-muted/50"
          onClick={() => onAddCard(column.id)}
        >
          <Plus className="h-3 w-3 mr-1.5" />
          Novo item
        </Button>
      </div>
    </div>
  );
});

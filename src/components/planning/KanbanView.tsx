import { useState } from 'react';
import { Plus, Clock, CheckCircle2, Lightbulb, FileEdit, Eye, ThumbsUp, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './PlanningItemCard';
import type { PlanningItem, KanbanColumn } from '@/hooks/usePlanningItems';

interface KanbanViewProps {
  columns: KanbanColumn[];
  getItemsByColumn: (columnId: string) => PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (item: PlanningItem) => void;
  onMoveItem: (itemId: string, columnId: string, position: number) => void;
  onAddCard: (columnId: string) => void;
}

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

export function KanbanView({
  columns,
  getItemsByColumn,
  onEditItem,
  onDeleteItem,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  onMoveItem,
  onAddCard,
}: KanbanViewProps) {
  const [draggedItem, setDraggedItem] = useState<PlanningItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, item: PlanningItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the column
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-column-id]')) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedItem && draggedItem.column_id !== columnId) {
      const columnItems = getItemsByColumn(columnId);
      const newPosition = columnItems.length;
      onMoveItem(draggedItem.id, columnId, newPosition);
    }
    setDraggedItem(null);
  };

  // Count failed items per column
  const getFailedCount = (items: PlanningItem[]) => 
    items.filter(i => i.status === 'failed').length;

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex gap-4 pb-4 min-h-full px-1">
        {columns.map(column => {
          const items = getItemsByColumn(column.id);
          const config = columnConfig[column.column_type || ''] || columnConfig.idea;
          const ColumnIcon = config.icon;
          const failedCount = getFailedCount(items);
          const isDropTarget = dragOverColumn === column.id;
          
          return (
            <div
              key={column.id}
              data-column-id={column.id}
              className={cn(
                "flex-shrink-0 w-72 bg-card/50 rounded-xl border border-border/50 flex flex-col max-h-[calc(100vh-280px)]",
                "transition-all duration-200 backdrop-blur-sm",
                isDropTarget && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background bg-primary/5 scale-[1.01]"
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header - Clean & Minimal */}
              <div className={cn(
                "px-3 py-2.5 rounded-t-xl border-b",
                config.headerBg
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", config.dotColor)} />
                    <span className={cn("font-medium text-sm", config.color)}>{column.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
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
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      "transition-all duration-150 hover:scale-[1.01]",
                      draggedItem?.id === item.id && "scale-95 opacity-50"
                    )}
                  >
                    <PlanningItemCard
                      item={item}
                      onEdit={onEditItem}
                      onDelete={onDeleteItem}
                      onMoveToLibrary={onMoveToLibrary}
                      onRetry={onRetry}
                      onDuplicate={onDuplicate}
                      isDragging={draggedItem?.id === item.id}
                      compact
                    />
                  </div>
                ))}

                {items.length === 0 && (
                  <div className={cn(
                    "text-center py-8 text-muted-foreground",
                    "border border-dashed rounded-lg",
                    isDropTarget && "border-primary bg-primary/5"
                  )}>
                    <ColumnIcon className={cn("h-5 w-5 mx-auto mb-2 opacity-40", config.color)} />
                    <p className="text-xs font-medium">
                      {isDropTarget ? 'Solte aqui' : 'Vazio'}
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Add Footer - Subtle */}
              <div className="p-1.5 border-t border-border/50">
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
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

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
  gradient: string; 
  icon: React.ElementType; 
  bgHover: string;
  dotColor: string;
}> = {
  idea: { 
    gradient: 'from-purple-500 to-purple-600', 
    icon: Lightbulb, 
    bgHover: 'hover:bg-purple-50 dark:hover:bg-purple-950/30',
    dotColor: 'bg-purple-500',
  },
  draft: { 
    gradient: 'from-blue-500 to-blue-600', 
    icon: FileEdit, 
    bgHover: 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
    dotColor: 'bg-blue-500',
  },
  review: { 
    gradient: 'from-yellow-500 to-yellow-600', 
    icon: Eye, 
    bgHover: 'hover:bg-yellow-50 dark:hover:bg-yellow-950/30',
    dotColor: 'bg-yellow-500',
  },
  approved: { 
    gradient: 'from-green-500 to-green-600', 
    icon: ThumbsUp, 
    bgHover: 'hover:bg-green-50 dark:hover:bg-green-950/30',
    dotColor: 'bg-green-500',
  },
  scheduled: { 
    gradient: 'from-orange-500 to-orange-600', 
    icon: CalendarClock, 
    bgHover: 'hover:bg-orange-50 dark:hover:bg-orange-950/30',
    dotColor: 'bg-orange-500',
  },
  published: { 
    gradient: 'from-slate-500 to-slate-600', 
    icon: CheckCircle2, 
    bgHover: 'hover:bg-slate-50 dark:hover:bg-slate-950/30',
    dotColor: 'bg-slate-500',
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
                "flex-shrink-0 w-80 bg-muted/30 rounded-xl border flex flex-col max-h-[calc(100vh-280px)]",
                "transition-all duration-200",
                isDropTarget && "ring-2 ring-primary ring-offset-2 bg-primary/5 scale-[1.02]"
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className={cn(
                "p-4 rounded-t-xl bg-gradient-to-r",
                config.gradient
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <ColumnIcon className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-semibold text-white">{column.name}</span>
                    <Badge 
                      variant="secondary" 
                      className="bg-white/20 text-white border-0 text-xs font-medium px-2"
                    >
                      {items.length}
                    </Badge>
                    {failedCount > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="text-xs font-medium px-2 animate-pulse"
                      >
                        {failedCount} falha{failedCount > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/20"
                    onClick={() => onAddCard(column.id)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "cursor-grab active:cursor-grabbing",
                      "transition-transform duration-150",
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
                    />
                  </div>
                ))}

                {items.length === 0 && (
                  <div className={cn(
                    "text-center py-12 text-muted-foreground",
                    "border-2 border-dashed rounded-xl",
                    isDropTarget && "border-primary bg-primary/5"
                  )}>
                    <div className={cn(
                      "w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center",
                      config.dotColor + '/20'
                    )}>
                      <ColumnIcon className={cn("h-5 w-5", config.dotColor.replace('bg-', 'text-'))} />
                    </div>
                    <p className="text-sm font-medium">
                      {isDropTarget ? 'Solte aqui' : 'Nenhum card'}
                    </p>
                    <p className="text-xs mt-1">
                      Arraste cards ou clique em +
                    </p>
                  </div>
                )}
              </div>

              {/* Quick Add Footer */}
              <div className="p-2 border-t bg-muted/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "w-full justify-start text-muted-foreground",
                    config.bgHover
                  )}
                  onClick={() => onAddCard(column.id)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar card
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

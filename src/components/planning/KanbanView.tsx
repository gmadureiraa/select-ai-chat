import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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

const columnColors: Record<string, string> = {
  idea: 'border-t-purple-500',
  draft: 'border-t-blue-500',
  review: 'border-t-yellow-500',
  approved: 'border-t-green-500',
  scheduled: 'border-t-orange-500',
  published: 'border-t-slate-400',
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
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
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

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex gap-4 pb-4 min-h-full">
        {columns.map(column => {
          const items = getItemsByColumn(column.id);
          const colorClass = columnColors[column.column_type || ''] || 'border-t-border';
          
          return (
            <div
              key={column.id}
              className={cn(
                "flex-shrink-0 w-72 bg-muted/30 rounded-lg border border-t-4 flex flex-col max-h-[calc(100vh-280px)]",
                colorClass,
                dragOverColumn === column.id && "ring-2 ring-primary/50 bg-primary/5"
              )}
              onDragOver={(e) => handleDragOver(e, column.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, column.id)}
            >
              {/* Column Header */}
              <div className="p-3 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{column.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {items.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onAddCard(column.id)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                    className="cursor-grab active:cursor-grabbing"
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
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    Arraste cards aqui
                  </div>
                )}
              </div>

              {/* Quick Add */}
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  onClick={() => onAddCard(column.id)}
                >
                  <Plus className="h-4 w-4 mr-1" />
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

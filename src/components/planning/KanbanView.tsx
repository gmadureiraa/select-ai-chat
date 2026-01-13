import { useState, useCallback, useEffect, useRef } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { VirtualizedKanbanColumn } from './VirtualizedKanbanColumn';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
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
  canDelete?: boolean;
}

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
  canDelete = true,
}: KanbanViewProps) {
  const isMobile = useIsMobile();
  const [draggedItem, setDraggedItem] = useState<PlanningItem | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [containerHeight, setContainerHeight] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate container height for virtualization
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        // Account for padding and scroll area chrome
        const availableHeight = window.innerHeight - rect.top - 40;
        setContainerHeight(Math.max(400, availableHeight));
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleDragStart = useCallback((e: React.DragEvent, item: PlanningItem) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
    setDraggedItem(null);
    setDragOverColumn(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('[data-column-id]')) {
      setDragOverColumn(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedItem && draggedItem.column_id !== columnId) {
      const columnItems = getItemsByColumn(columnId);
      const newPosition = columnItems.length;
      onMoveItem(draggedItem.id, columnId, newPosition);
    }
    setDraggedItem(null);
  }, [draggedItem, getItemsByColumn, onMoveItem]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <ScrollArea className="h-full w-full">
        <div className={cn(
          "flex pb-4 min-h-full px-1",
          isMobile ? "gap-3 snap-x snap-mandatory overflow-x-auto" : "gap-6"
        )}>
          {columns.map(column => {
            const items = getItemsByColumn(column.id);
            
            return (
              <VirtualizedKanbanColumn
                key={column.id}
                column={column}
                items={items}
                onEditItem={onEditItem}
                onDeleteItem={onDeleteItem}
                onMoveToLibrary={onMoveToLibrary}
                onRetry={onRetry}
                onDuplicate={onDuplicate}
                onAddCard={onAddCard}
                canDelete={canDelete}
                isDropTarget={dragOverColumn === column.id}
                draggedItemId={draggedItem?.id || null}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                height={containerHeight}
                className={isMobile ? "w-[85vw] min-w-[85vw] snap-center" : undefined}
              />
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

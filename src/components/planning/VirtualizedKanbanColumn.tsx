import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PlanningItemCard } from './PlanningItemCard';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import type { PlanningItem, KanbanColumn } from '@/hooks/usePlanningItems';
import type { ViewSettings } from './ViewSettingsPopover';

// Usa CSS vars --status-* declaradas em index.css (light/dark separados).
// Substitui hardcoded bg-purple/blue/amber/etc que não respeitavam dark mode.
const columnConfig: Record<string, { dotColor: string }> = {
  idea: { dotColor: 'bg-[hsl(var(--status-idea))]' },
  draft: { dotColor: 'bg-[hsl(var(--status-draft))]' },
  review: { dotColor: 'bg-[hsl(var(--status-review))]' },
  approved: { dotColor: 'bg-[hsl(var(--status-approved))]' },
  scheduled: { dotColor: 'bg-[hsl(var(--status-scheduled))]' },
  publishing: { dotColor: 'bg-[hsl(var(--status-publishing))]' },
  published: { dotColor: 'bg-[hsl(var(--status-published))]' },
  failed: { dotColor: 'bg-[hsl(var(--status-failed))]' },
};

interface VirtualizedKanbanColumnProps {
  column: KanbanColumn;
  items: PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (item: PlanningItem) => void;
  onQuickRename?: (id: string, title: string) => void;
  onAddCard: (columnId: string) => void;
  canDelete?: boolean;
  activeItemId: string | null;
  /** ID do item em foco via teclado (j/k). */
  focusedItemId?: string | null;
  /** Set de IDs selecionados (shift-click). */
  selectedIds?: Set<string>;
  onCardClick?: (item: PlanningItem, e: React.MouseEvent) => void;
  /** Indicador visual de drop position — id do card sobre o qual está o drag. */
  dropIndicatorId?: string | null;
  height: number;
  className?: string;
  viewSettings?: ViewSettings;
  memberMap?: Record<string, { name: string; initials: string }>;
}

interface SortableCardProps {
  item: PlanningItem;
  isActive: boolean;
  onEdit: (item: PlanningItem) => void;
  onDelete: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (item: PlanningItem) => void;
  onQuickRename?: (id: string, title: string) => void;
  canDelete?: boolean;
  viewSettings?: ViewSettings;
  memberMap?: Record<string, { name: string; initials: string }>;
  isSelected?: boolean;
  hasSelection?: boolean;
  onCardClick?: (item: PlanningItem, e: React.MouseEvent) => void;
  isFocused?: boolean;
  showDropIndicator?: boolean;
}

const SortableCard = memo(function SortableCard({
  item,
  isActive,
  onEdit,
  onDelete,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  onQuickRename,
  canDelete,
  viewSettings,
  memberMap,
  isSelected,
  hasSelection,
  onCardClick,
  isFocused,
  showDropIndicator,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-card-id={item.id}
      className={cn(
        'relative cursor-grab active:cursor-grabbing touch-none',
        (isDragging || isActive) && 'opacity-40',
      )}
    >
      {/* Indicador de drop — linha azul horizontal acima do card alvo */}
      {(isOver || showDropIndicator) && !isDragging && !isActive && (
        <div
          className="absolute -top-1 left-0 right-0 h-0.5 bg-primary rounded-full z-10 shadow-[0_0_8px_hsl(var(--primary)/0.5)] pointer-events-none"
          aria-hidden="true"
        />
      )}
      <PlanningItemCard
        item={item}
        onEdit={onEdit}
        onDelete={onDelete}
        onMoveToLibrary={onMoveToLibrary}
        onRetry={onRetry}
        onDuplicate={onDuplicate}
        onQuickRename={onQuickRename}
        isDragging={isDragging || isActive}
        compact={false}
        canDelete={canDelete}
        viewSettings={viewSettings}
        memberMap={memberMap}
        isSelected={isSelected}
        hasSelection={hasSelection}
        onCardClick={onCardClick}
        isFocused={isFocused}
      />
    </div>
  );
});

export const VirtualizedKanbanColumn = memo(function VirtualizedKanbanColumn({
  column,
  items,
  onEditItem,
  onDeleteItem,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  onQuickRename,
  onAddCard,
  canDelete = true,
  activeItemId,
  focusedItemId,
  selectedIds,
  onCardClick,
  dropIndicatorId,
  height,
  className,
  viewSettings,
  memberMap,
}: VirtualizedKanbanColumnProps) {
  const config = columnConfig[column.column_type || ''] || columnConfig.idea;
  const failedCount = items.filter(i => i.status === 'failed').length;
  const listHeight = Math.max(200, height - 60);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ top: false, bottom: false });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: column.id });

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

  const itemIds = items.map(i => i.id);

  return (
    <div
      data-column-id={column.id}
      className={cn(
        'flex-shrink-0 bg-muted/40 dark:bg-muted/20 border border-border/40 rounded-lg flex flex-col transition-all duration-150',
        !className && 'w-80',
        className,
        // Borda primary forte + ring quando algo está sobrevoando a coluna
        isOver && 'bg-primary/10 border-primary ring-2 ring-primary/30',
      )}
      style={{ maxHeight: height }}
    >
      {/* Header */}
      <div className="px-2 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', config.dotColor)} />
            <span className="font-medium text-sm text-foreground">{column.name}</span>
            <span className="text-xs text-muted-foreground tabular-nums">{items.length}</span>
            {failedCount > 0 && (
              <span className="text-[10px] text-red-500 font-medium">{failedCount} ⚠</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onAddCard(column.id)}
            aria-label={`Adicionar card em ${column.name}`}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Cards */}
      <div ref={setDroppableRef} className="flex-1 min-h-0 relative">
        {items.length === 0 ? (
          <div
            className={cn(
              'mx-2 py-8 text-center text-muted-foreground border border-dashed border-border/50 rounded-lg transition-colors duration-150',
              isOver && 'border-primary/50 bg-primary/5',
            )}
          >
            <p className="text-xs">{isOver ? 'Solte aqui' : 'Vazio'}</p>
          </div>
        ) : (
          <>
            <div
              className={cn(
                'absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none transition-opacity',
                scrollState.top ? 'opacity-100' : 'opacity-0',
              )}
            />
            <div
              ref={scrollRef}
              className="px-1 pb-2 space-y-2 overflow-y-auto scrollbar-thin"
              style={{ maxHeight: listHeight }}
            >
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <SortableCard
                    key={item.id}
                    item={item}
                    isActive={activeItemId === item.id}
                    onEdit={onEditItem}
                    onDelete={onDeleteItem}
                    onMoveToLibrary={onMoveToLibrary}
                    onRetry={onRetry}
                    onDuplicate={onDuplicate}
                    onQuickRename={onQuickRename}
                    canDelete={canDelete}
                    viewSettings={viewSettings}
                    memberMap={memberMap}
                    isSelected={selectedIds?.has(item.id)}
                    hasSelection={(selectedIds?.size ?? 0) > 0}
                    onCardClick={onCardClick}
                    isFocused={focusedItemId === item.id}
                    showDropIndicator={dropIndicatorId === item.id}
                  />
                ))}
              </SortableContext>
            </div>
            <div
              className={cn(
                'absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none transition-opacity',
                scrollState.bottom ? 'opacity-100' : 'opacity-0',
              )}
            />
          </>
        )}
      </div>

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

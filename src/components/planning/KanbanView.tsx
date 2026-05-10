import { useState, useCallback, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { VirtualizedKanbanColumn } from './VirtualizedKanbanColumn';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { PlanningItemCard } from './PlanningItemCard';
import { EmptyState } from './EmptyState';
import type { PlanningItem, KanbanColumn, PlanningStatus } from '@/hooks/usePlanningItems';
import type { ViewSettings } from './ViewSettingsPopover';

export interface KanbanViewHandle {
  /** Move o foco visual entre cards (atalhos j/k). */
  moveFocus: (direction: 'next' | 'prev') => void;
  /** Abre o card focado (atalho Enter/e). */
  openFocused: () => void;
  /** Item atualmente focado. */
  getFocusedItem: () => PlanningItem | null;
}

interface KanbanViewProps {
  columns: KanbanColumn[];
  getItemsByColumn: (columnId: string) => PlanningItem[];
  onEditItem: (item: PlanningItem) => void;
  onDeleteItem: (id: string) => void;
  onMoveToLibrary: (id: string) => void;
  onRetry: (id: string) => void;
  onDuplicate: (item: PlanningItem) => void;
  onQuickRename?: (id: string, title: string) => void;
  /** Legacy: cross-column move with status update */
  onMoveItem: (itemId: string, columnId: string, position: number) => void;
  /** New: batch reorder for drag & drop (preferred when provided) */
  onReorder?: (updates: Array<{ id: string; column_id: string; position: number; status?: PlanningStatus }>) => void;
  onAddCard: (columnId: string) => void;
  canDelete?: boolean;
  viewSettings?: ViewSettings;
  memberMap?: Record<string, { name: string; initials: string }>;
  /** Set de IDs selecionados (shift-click). */
  selectedIds?: Set<string>;
  /** Handler de click no card (decide entre selecionar ou abrir). */
  onCardClick?: (item: PlanningItem, e: React.MouseEvent) => void;
}

const STATUS_MAP: Record<string, PlanningStatus> = {
  idea: 'idea',
  draft: 'draft',
  review: 'review',
  approved: 'approved',
  scheduled: 'scheduled',
  published: 'published',
};

export const KanbanView = forwardRef<KanbanViewHandle, KanbanViewProps>(function KanbanView({
  columns,
  getItemsByColumn,
  onEditItem,
  onDeleteItem,
  onMoveToLibrary,
  onRetry,
  onDuplicate,
  onQuickRename,
  onMoveItem,
  onReorder,
  onAddCard,
  canDelete = true,
  viewSettings,
  memberMap,
  selectedIds,
  onCardClick,
}: KanbanViewProps, ref) {
  const isMobile = useIsMobile();
  const [activeItem, setActiveItem] = useState<PlanningItem | null>(null);
  const [containerHeight, setContainerHeight] = useState(500);
  const containerRef = useRef<HTMLDivElement>(null);
  // Foco visual via teclado (j/k)
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
  // Card alvo do drag pra mostrar indicador de drop position
  const [dropOverId, setDropOverId] = useState<string | null>(null);

  // Local optimistic columns map (so cards appear to move while dragging)
  const [localColumnsMap, setLocalColumnsMap] = useState<Record<string, PlanningItem[]> | null>(null);

  const baseColumnsMap = useMemo(() => {
    const map: Record<string, PlanningItem[]> = {};
    for (const col of columns) {
      map[col.id] = getItemsByColumn(col.id);
    }
    return map;
  }, [columns, getItemsByColumn]);

  const columnsMap = localColumnsMap ?? baseColumnsMap;

  // Index: itemId -> columnId
  const itemColumnIndex = useMemo(() => {
    const idx: Record<string, string> = {};
    for (const colId in columnsMap) {
      for (const item of columnsMap[colId]) idx[item.id] = colId;
    }
    return idx;
  }, [columnsMap]);

  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top - 40;
        setContainerHeight(Math.max(400, availableHeight));
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnIdOf = useCallback(
    (id: string): string | null => {
      if (columnsMap[id]) return id; // dropped on column itself
      return itemColumnIndex[id] ?? null;
    },
    [columnsMap, itemColumnIndex],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    const colId = itemColumnIndex[id];
    const item = colId ? columnsMap[colId].find(i => i.id === id) : null;
    setActiveItem(item ?? null);
    // Cursor global durante drag
    document.body.style.cursor = 'grabbing';
  }, [columnsMap, itemColumnIndex]);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      setDropOverId(null);
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    // Atualiza indicador de drop
    setDropOverId(overId !== activeId ? overId : null);
    if (activeId === overId) return;

    const activeCol = findColumnIdOf(activeId);
    const overCol = findColumnIdOf(overId);
    if (!activeCol || !overCol) return;
    if (activeCol === overCol) return;

    setLocalColumnsMap(prev => {
      const base = prev ?? baseColumnsMap;
      const activeItems = [...(base[activeCol] ?? [])];
      const overItems = [...(base[overCol] ?? [])];
      const activeIdx = activeItems.findIndex(i => i.id === activeId);
      if (activeIdx === -1) return prev;
      const [moved] = activeItems.splice(activeIdx, 1);

      // Insert at the position of `over` if it's a card; otherwise at end
      const overIdx = overItems.findIndex(i => i.id === overId);
      const insertAt = overIdx === -1 ? overItems.length : overIdx;
      overItems.splice(insertAt, 0, { ...moved, column_id: overCol });

      return {
        ...base,
        [activeCol]: activeItems,
        [overCol]: overItems,
      };
    });
  }, [baseColumnsMap, findColumnIdOf]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setDropOverId(null);
    document.body.style.cursor = '';
    if (!over) {
      setLocalColumnsMap(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // Resolve final state from local (already updated in dragOver) or base
    const finalMap = localColumnsMap ?? baseColumnsMap;
    const sourceCol = findColumnIdOf(activeId);
    if (!sourceCol) {
      setLocalColumnsMap(null);
      return;
    }

    // Reorder within the resolved source column if dropping over a sibling card
    let workingMap = finalMap;
    const sameColOver = workingMap[sourceCol]?.some(i => i.id === overId);
    if (sameColOver && activeId !== overId) {
      const list = [...workingMap[sourceCol]];
      const fromIdx = list.findIndex(i => i.id === activeId);
      const toIdx = list.findIndex(i => i.id === overId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const [moved] = list.splice(fromIdx, 1);
        list.splice(toIdx, 0, moved);
        workingMap = { ...workingMap, [sourceCol]: list };
      }
    }

    // Compute diffs vs base
    const updates: Array<{ id: string; column_id: string; position: number; status?: PlanningStatus }> = [];
    for (const colId in workingMap) {
      const column = columns.find(c => c.id === colId);
      const newStatus = column?.column_type ? STATUS_MAP[column.column_type] : undefined;
      workingMap[colId].forEach((item, idx) => {
        const baseItem = baseColumnsMap[item.id ? itemColumnIndex[item.id] : '']?.find(i => i.id === item.id);
        const movedColumn = baseItem?.column_id !== colId;
        const movedPosition = baseItem?.position !== idx;
        if (movedColumn || movedPosition) {
          updates.push({
            id: item.id,
            column_id: colId,
            position: idx,
            status: movedColumn ? newStatus : undefined,
          });
        }
      });
    }

    if (updates.length > 0) {
      if (onReorder) {
        onReorder(updates);
      } else {
        // Fallback: only handle the active item with legacy single-move API
        const activeUpdate = updates.find(u => u.id === activeId);
        if (activeUpdate) onMoveItem(activeUpdate.id, activeUpdate.column_id, activeUpdate.position);
      }
    }

    setLocalColumnsMap(null);
  }, [baseColumnsMap, columns, findColumnIdOf, itemColumnIndex, localColumnsMap, onMoveItem, onReorder]);

  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setLocalColumnsMap(null);
    setDropOverId(null);
    document.body.style.cursor = '';
  }, []);

  // Lista linear de items (ordem visual) pra navegação j/k
  const flatItems = useMemo(() => {
    const flat: PlanningItem[] = [];
    columns.forEach(col => {
      const list = columnsMap[col.id] ?? [];
      list.forEach(it => flat.push(it));
    });
    return flat;
  }, [columns, columnsMap]);

  // Garante que um item exista no foco (vai pro primeiro se válido)
  useEffect(() => {
    if (focusedItemId && !flatItems.find(i => i.id === focusedItemId)) {
      setFocusedItemId(null);
    }
  }, [flatItems, focusedItemId]);

  const moveFocus = useCallback((direction: 'next' | 'prev') => {
    if (flatItems.length === 0) return;
    if (!focusedItemId) {
      // Sem foco — começa do primeiro item visível
      setFocusedItemId(flatItems[0].id);
      requestAnimationFrame(() => {
        const el = containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${flatItems[0].id}"]`);
        el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
      return;
    }
    const idx = flatItems.findIndex(i => i.id === focusedItemId);
    const nextIdx = direction === 'next'
      ? Math.min(idx + 1, flatItems.length - 1)
      : Math.max(idx - 1, 0);
    const nextId = flatItems[nextIdx].id;
    setFocusedItemId(nextId);
    requestAnimationFrame(() => {
      const el = containerRef.current?.querySelector<HTMLElement>(`[data-card-id="${nextId}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [flatItems, focusedItemId]);

  const openFocused = useCallback(() => {
    if (!focusedItemId) return;
    const item = flatItems.find(i => i.id === focusedItemId);
    if (item) onEditItem(item);
  }, [flatItems, focusedItemId, onEditItem]);

  useImperativeHandle(ref, () => ({
    moveFocus,
    openFocused,
    getFocusedItem: () => flatItems.find(i => i.id === focusedItemId) ?? null,
  }), [moveFocus, openFocused, flatItems, focusedItemId]);

  if (columns.length === 0) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center">
        <EmptyState
          type="kanban"
          title="Nenhuma coluna configurada"
          description="As colunas padrão (Ideias, Rascunho, Revisão, Aprovado, Agendado, Publicado) ainda não foram criadas para este workspace."
        />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <ScrollArea className="h-full w-full">
          <div className={cn(
            "flex pb-4 min-h-full px-2",
            isMobile ? "gap-3 snap-x snap-mandatory overflow-x-auto" : "gap-4"
          )}>
            {columns.map(column => {
              const items = columnsMap[column.id] ?? [];
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
                  onQuickRename={onQuickRename}
                  onAddCard={onAddCard}
                  canDelete={canDelete}
                  activeItemId={activeItem?.id ?? null}
                  focusedItemId={focusedItemId}
                  selectedIds={selectedIds}
                  onCardClick={onCardClick}
                  dropIndicatorId={dropOverId}
                  height={containerHeight}
                  className={isMobile ? "w-[90vw] min-w-[90vw] snap-center" : undefined}
                  viewSettings={viewSettings}
                  memberMap={memberMap}
                />
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay dropAnimation={null}>
          {activeItem ? (
            <div className="rotate-2 opacity-95 shadow-2xl scale-[1.02] cursor-grabbing">
              <PlanningItemCard
                item={activeItem}
                onEdit={() => {}}
                onDelete={() => {}}
                onMoveToLibrary={() => {}}
                isDragging
                viewSettings={viewSettings}
                memberMap={memberMap}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});

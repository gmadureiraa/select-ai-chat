import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanningItems, type PlanningFilters, type PlanningItem } from '@/hooks/usePlanningItems';
import { PlanningFilters as FiltersComponent } from './PlanningFilters';
import { ViewToggle, type PlanningView } from './ViewToggle';
import { PlanningItemCard } from './PlanningItemCard';
import { PlanningItemDialog } from './PlanningItemDialog';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';

interface PlanningBoardProps {
  clientId?: string;
}

export function PlanningBoard({ clientId }: PlanningBoardProps) {
  const [view, setView] = useState<PlanningView>('board');
  const [filters, setFilters] = useState<PlanningFilters>(clientId ? { clientId } : {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>();

  const {
    items,
    columns,
    isLoading,
    createItem,
    updateItem,
    deleteItem,
    moveToColumn,
    moveToLibrary,
    retryPublication,
    getItemsByColumn,
  } = usePlanningItems(filters);

  const handleCreateItem = async (data: Parameters<typeof createItem.mutateAsync>[0]) => {
    await createItem.mutateAsync(data);
  };

  const handleUpdateItem = async (id: string, data: Partial<PlanningItem>) => {
    await updateItem.mutateAsync({ id, ...data });
  };

  const handleEdit = (item: PlanningItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleNewCard = (columnId?: string, date?: Date) => {
    setEditingItem(null);
    setDefaultColumnId(columnId);
    setDefaultDate(date);
    setDialogOpen(true);
  };

  const handleDuplicate = (item: PlanningItem) => {
    createItem.mutate({
      ...item,
      title: `${item.title} (cópia)`,
      client_id: item.client_id || undefined,
      column_id: item.column_id || undefined,
      platform: item.platform || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Planejamento</h2>
          <ViewToggle view={view} onChange={setView} />
        </div>
        <Button onClick={() => handleNewCard()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Novo Card
        </Button>
      </div>

      {/* Filters */}
      <FiltersComponent filters={filters} onChange={setFilters} />

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'board' && (
          <KanbanView
            columns={columns}
            getItemsByColumn={getItemsByColumn}
            onEditItem={handleEdit}
            onDeleteItem={(id) => deleteItem.mutate(id)}
            onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
            onRetry={(id) => retryPublication.mutate(id)}
            onDuplicate={handleDuplicate}
            onMoveItem={(itemId, columnId, position) => moveToColumn.mutate({ itemId, columnId, newPosition: position })}
            onAddCard={(columnId) => handleNewCard(columnId)}
          />
        )}

        {view === 'calendar' && (
          <CalendarView
            items={items}
            onEditItem={handleEdit}
            onAddItem={(date) => handleNewCard(undefined, date)}
            onDeleteItem={(id) => deleteItem.mutate(id)}
            onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
            onRetry={(id) => retryPublication.mutate(id)}
          />
        )}

        {view === 'list' && (
          <div className="space-y-2 overflow-y-auto max-h-full p-1">
            {items.map(item => (
              <PlanningItemCard
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onDelete={(id) => deleteItem.mutate(id)}
                onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
                onRetry={(id) => retryPublication.mutate(id)}
                onDuplicate={handleDuplicate}
                compact
              />
            ))}
            {items.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum item encontrado
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog */}
      <PlanningItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editingItem}
        columns={columns}
        defaultColumnId={defaultColumnId}
        defaultDate={defaultDate}
        onSave={handleCreateItem}
        onUpdate={handleUpdateItem}
      />
    </div>
  );
}

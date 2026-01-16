import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Loader2, Zap, Eye, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { usePlanningItems, type PlanningFilters, type PlanningItem } from '@/hooks/usePlanningItems';
import { usePlanningRealtime } from '@/hooks/usePlanningRealtime';
import { usePlanningKeyboardShortcuts, getShortcutHint } from '@/hooks/usePlanningKeyboardShortcuts';
import { PlanningFilters as FiltersComponent } from './PlanningFilters';
import { ViewToggle, type PlanningView } from './ViewToggle';
import { PlanningItemCard } from './PlanningItemCard';
import { PlanningItemDialog } from './PlanningItemDialog';
import { KanbanView } from './KanbanView';
import { CalendarView } from './CalendarView';
import { ViewSettingsPopover, useViewSettings } from './ViewSettingsPopover';
import { EmptyState } from './EmptyState';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useMemberClientAccess } from '@/hooks/useMemberClientAccess';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { PlanningAutomations } from './PlanningAutomations';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface PlanningBoardProps {
  clientId?: string;
  isEnterprise?: boolean;
  onClientChange?: (clientId: string | null) => void;
}

export function PlanningBoard({ clientId, isEnterprise = false, onClientChange }: PlanningBoardProps) {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [view, setView] = useState<PlanningView>('board');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PlanningItem | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | undefined>();
  const [defaultColumnId, setDefaultColumnId] = useState<string | undefined>();
  const [showAutomations, setShowAutomations] = useState(false);
  const { settings, setSettings } = useViewSettings();
  
  const { isViewer, workspace } = useWorkspace();
  const { members } = useTeamMembers();
  
  // Find current user's member record to get their client access
  const currentMember = useMemo(() => {
    return members.find(m => m.workspace_id === workspace?.id);
  }, [members, workspace?.id]);
  
  const { clientIds: viewerClientIds } = useMemberClientAccess(currentMember?.id);
  
  // For viewers, force the clientId filter to only show allowed clients
  const [localFilters, setLocalFilters] = useState<PlanningFilters>({});
  
  // Effective filters - use localFilters.clientId if set, otherwise use prop clientId
  const effectiveFilters = useMemo(() => {
    if (localFilters.clientId !== undefined) {
      if (isViewer && viewerClientIds.length > 0) {
        const allowedClientId = localFilters.clientId && viewerClientIds.includes(localFilters.clientId)
          ? localFilters.clientId
          : viewerClientIds[0];
        return { ...localFilters, clientId: allowedClientId };
      }
      if (localFilters.clientId === '') {
        const { clientId: _, ...rest } = localFilters;
        return rest;
      }
      return localFilters;
    }
    
    if (clientId) {
      return { ...localFilters, clientId };
    }
    
    if (isViewer && viewerClientIds.length > 0) {
      return { ...localFilters, clientId: viewerClientIds[0] };
    }
    
    return localFilters;
  }, [clientId, localFilters, isViewer, viewerClientIds]);

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
  } = usePlanningItems(effectiveFilters);

  usePlanningRealtime();

  useEffect(() => {
    const openItemId = searchParams.get('openItem');
    if (openItemId && items.length > 0) {
      const itemToOpen = items.find(item => item.id === openItemId);
      if (itemToOpen) {
        setEditingItem(itemToOpen);
        setDialogOpen(true);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('openItem');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, items, setSearchParams]);

  const handleFiltersChange = (newFilters: PlanningFilters) => {
    if (isViewer && viewerClientIds.length > 0 && newFilters.clientId) {
      if (!viewerClientIds.includes(newFilters.clientId)) {
        return;
      }
    }
    setLocalFilters(newFilters);
    
    if (onClientChange && newFilters.clientId !== undefined) {
      onClientChange(newFilters.clientId || null);
    }
  };

  const handleCreateItem = async (data: Parameters<typeof createItem.mutateAsync>[0]) => {
    const result = await createItem.mutateAsync(data);
    return result;
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

  const handleMoveToDate = useCallback((itemId: string, newDate: Date) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;

    const updateData = item.scheduled_at
      ? { scheduled_at: format(newDate, "yyyy-MM-dd'T'HH:mm:ss") }
      : { due_date: format(newDate, 'yyyy-MM-dd') };

    updateItem.mutate({ id: itemId, ...updateData });
    toast.success('Item movido para ' + format(newDate, 'dd/MM'));
  }, [items, updateItem]);

  // Keyboard shortcuts
  usePlanningKeyboardShortcuts({
    onNewItem: () => handleNewCard(),
    onCloseDialog: () => setDialogOpen(false),
    isDialogOpen: dialogOpen,
  });
  
  const showFilters = !(isViewer && viewerClientIds.length === 1);
  const isEmpty = items.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          <span>Modo visualização — você pode criar e mover itens</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ViewToggle view={view} onChange={setView} />
        </div>
        
        {!isViewer && (
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => setShowAutomations(!showAutomations)}
                    className={cn("h-8 w-8", showAutomations && 'bg-primary/10 text-primary')}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Automações</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <ViewSettingsPopover settings={settings} onChange={setSettings} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => handleNewCard()} size="sm" className="h-8 gap-1.5">
                    <Plus className="h-4 w-4" />
                    {!isMobile && <span>Novo</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <span>Novo item</span>
                  <span className="ml-2 text-muted-foreground text-[10px]">{getShortcutHint('N')}</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <FiltersComponent 
          filters={effectiveFilters} 
          onChange={handleFiltersChange} 
        />
      )}

      {/* Automations Panel */}
      {showAutomations && (
        <div className="mb-2">
          <PlanningAutomations />
        </div>
      )}

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
            canDelete={!isViewer}
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
            onMoveItem={handleMoveToDate}
            canEdit={!isViewer}
          />
        )}

        {view === 'list' && (
          <div className="h-full overflow-y-auto space-y-2 pr-2">
            {isEmpty ? (
              <EmptyState
                type="list"
                action={{
                  label: 'Criar primeiro item',
                  onClick: () => handleNewCard(),
                }}
              />
            ) : (
              items.map(item => (
                <PlanningItemCard
                  key={item.id}
                  item={item}
                  onEdit={handleEdit}
                  onDelete={(id) => deleteItem.mutate(id)}
                  onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
                  onRetry={(id) => retryPublication.mutate(id)}
                  onDuplicate={handleDuplicate}
                  compact
                  canDelete={!isViewer}
                />
              ))
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
        defaultClientId={localFilters.clientId || clientId}
        onSave={handleCreateItem}
        onUpdate={handleUpdateItem}
      />
    </div>
  );
}

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { useSearchParams } from 'react-router-dom';
import { Plus, Zap, Eye, Keyboard, Upload, CalendarDays, Columns3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TabHeader } from '@/components/kai/TabHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { usePlanningItems, type PlanningFilters, type PlanningItem } from '@/hooks/usePlanningItems';
import { apiInvoke } from '@/lib/apiInvoke';
import { usePlanningRealtime } from '@/hooks/usePlanningRealtime';
import { usePlanningKeyboardShortcuts, getShortcutHint } from '@/hooks/usePlanningKeyboardShortcuts';
import { PlanningFilters as FiltersComponent, type PlanningFiltersHandle } from './PlanningFilters';
import { ViewToggle, type PlanningView } from './ViewToggle';
import { PlanningItemCard } from './PlanningItemCard';
import { PlanningListRow } from './PlanningListRow';
import { KanbanView, type KanbanViewHandle } from './KanbanView';
import { CalendarView } from './CalendarView';
import { ViewSettingsPopover, useViewSettings } from './ViewSettingsPopover';
import { EmptyState } from './EmptyState';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useMemberClientAccess } from '@/hooks/useMemberClientAccess';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { PlanningAutomations } from './PlanningAutomations';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';

// 2026-05-17 — Dialogs e views opcionais lazy. PlanningItemDialog (form
// pesado), MetricoolCalendarView (placeholder legado, view "editorial"),
// KeyboardShortcutsDialog (só abre ao apertar "?"), ColumnsCustomizeDialog
// (admin) e ClickUpImportDialog (importação manual) — nenhum deles é
// usado no primeiro paint do Planning. Saem ~30-50kB do chunk principal.
const PlanningItemDialog = lazyWithRetry(() =>
  import('./PlanningItemDialog').then((m) => ({ default: m.PlanningItemDialog })),
);
// 2026-05-18 rev2 — MetricoolCalendarView removido (Metricool foi-se).
// View "editorial" mostra placeholder até equivalente Late/Zernio entrar.
// Aceita as props originais (clientId, onCreatePlanningItem) pra manter o JSX
// chamando sem refactor — só não usa nenhuma delas.
const MetricoolCalendarView = (_props: {
  clientId?: string;
  onCreatePlanningItem?: (date: Date, eventTitle?: string) => void;
}) => (
  <div className="text-center py-12 px-4 text-sm text-muted-foreground">
    Calendário editorial em migração pro Late/Zernio. Use a view Kanban por enquanto.
  </div>
);
const KeyboardShortcutsDialog = lazyWithRetry(() =>
  import('./KeyboardShortcutsDialog').then((m) => ({
    default: m.KeyboardShortcutsDialog,
  })),
);
const ColumnsCustomizeDialog = lazyWithRetry(() =>
  import('./ColumnsCustomizeDialog').then((m) => ({
    default: m.ColumnsCustomizeDialog,
  })),
);
const ClickUpImportDialog = lazyWithRetry(() =>
  import('./ClickUpImportDialog').then((m) => ({
    default: m.ClickUpImportDialog,
  })),
);

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
  const [defaultTitle, setDefaultTitle] = useState<string | undefined>();
  const [showAutomations, setShowAutomations] = useState(false);
  const [showClickUpImport, setShowClickUpImport] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showColumnsCustomize, setShowColumnsCustomize] = useState(false);
  // Seleção múltipla via shift-click (apenas no Kanban)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Refs pra integrar atalhos de teclado
  const filtersRef = useRef<PlanningFiltersHandle>(null);
  const kanbanRef = useRef<KanbanViewHandle>(null);
  const { settings, setSettings } = useViewSettings();
  
  const { isViewer, workspace } = useWorkspace();
  const { members } = useTeamMembers();
  
  // Find current user's member record to get their client access
  const currentMember = useMemo(() => {
    return members.find(m => m.workspace_id === workspace?.id);
  }, [members, workspace?.id]);
  
  const { clientIds: viewerClientIds } = useMemberClientAccess(currentMember?.id);

  // memberMap: user_id -> { name, initials } para o card mostrar nome do responsável sem N queries
  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; initials: string }> = {};
    members.forEach((m: any) => {
      const profile = m.profile;
      if (!profile) return;
      const fullName: string = profile.full_name || profile.email || 'Membro';
      const parts = fullName.trim().split(/\s+/);
      const initials = (parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
      // Nome curto: "João S."
      const shortName = parts.length > 1
        ? `${parts[0]} ${parts[parts.length - 1][0]}.`
        : parts[0];
      map[m.user_id] = { name: shortName, initials: initials.toUpperCase() || '👤' };
    });
    return map;
  }, [members]);

  // For viewers, force the clientId filter to only show allowed clients
  const [localFilters, setLocalFilters] = useState<PlanningFilters>({});
  
  // Effective filters - use localFilters.clientId if set, otherwise use prop clientId
  const effectiveFilters = useMemo<PlanningFilters>(() => {
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
    reorderItems,
    moveToLibrary,
    retryPublication,
    getItemsByColumn,
  } = usePlanningItems(effectiveFilters);

  usePlanningRealtime();

  // Rastreia qual openItemId já foi processado pra evitar loop de
  // setSearchParams → re-render → effect re-roda. Sem essa guard, o
  // poll a cada 15s recriava ref de `items`, retrigerando o effect e
  // causando "piscar" da aba.
  const handledOpenItemRef = useRef<string | null>(null);

  useEffect(() => {
    const openItemId = searchParams.get('openItem');
    if (!openItemId) {
      handledOpenItemRef.current = null;
      return;
    }
    if (handledOpenItemRef.current === openItemId) return;

    const clearParam = () => {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('openItem');
      setSearchParams(newParams, { replace: true });
    };

    // 1. Card está na lista filtrada atual → abre direto.
    const inList = items.find((item) => item.id === openItemId);
    if (inList) {
      handledOpenItemRef.current = openItemId;
      setEditingItem(inList);
      setDialogOpen(true);
      clearParam();
      return;
    }

    // 2. Ainda carregando a lista → espera (NÃO marca handled, re-roda quando
    //    isLoading virar false / items chegarem).
    if (isLoading) return;

    // 3. Lista carregada mas o card não está nela (é de outro cliente/status,
    //    fora do filtro atual). Busca o card por id e abre — assim QUALQUER link
    //    com ?openItem=<id> abre o card certo, independente do filtro.
    //    2026-05-20 (Gabriel): "links de planning deveriam abrir o card correto".
    handledOpenItemRef.current = openItemId;
    (async () => {
      try {
        const { data, error } = await apiInvoke<{ item: PlanningItem }>(
          'planning-items-get',
          { body: { id: openItemId } },
        );
        if (!error && data?.item) {
          setEditingItem(data.item);
          setDialogOpen(true);
        }
      } catch {
        /* ignore */
      } finally {
        clearParam();
      }
    })();
  }, [searchParams, items, isLoading, setSearchParams]);

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

  const handleNewCard = (columnId?: string, date?: Date, title?: string) => {
    setEditingItem(null);
    setDefaultColumnId(columnId);
    setDefaultDate(date);
    setDefaultTitle(title);
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

    // Helper: troca a DATA preservando o HORÁRIO da âncora original.
    const withDateOf = (iso: string) => {
      const o = parseISO(iso);
      return new Date(
        newDate.getFullYear(), newDate.getMonth(), newDate.getDate(),
        o.getHours(), o.getMinutes(), o.getSeconds()
      ).toISOString();
    };

    // A coluna do calendário ancora o item por scheduled_at || published_at ||
    // due_date (nessa ordem). Pra "mover" de fato, precisamos atualizar a MESMA
    // âncora que posiciona o item — senão o toast dispara mas nada se move.
    // 2026-05-20 fix Gabriel: item publicado é ancorado por published_at; antes
    // caía no else e mexia só em due_date (ignorado), então não saía do lugar.
    let updateData: { scheduled_at?: string; due_date?: string; published_at?: string };

    if (item.scheduled_at) {
      updateData = { scheduled_at: withDateOf(item.scheduled_at) };
    } else if (item.status === 'published' || item.published_at) {
      updateData = {
        published_at: item.published_at ? withDateOf(item.published_at) : (() => {
          const d = new Date(newDate.getFullYear(), newDate.getMonth(), newDate.getDate(), 12, 0, 0);
          return d.toISOString();
        })(),
      };
    } else {
      // For due_date, use the date string directly to avoid timezone issues
      const year = newDate.getFullYear();
      const month = String(newDate.getMonth() + 1).padStart(2, '0');
      const day = String(newDate.getDate()).padStart(2, '0');
      updateData = { due_date: `${year}-${month}-${day}` };
    }

    // silent=true → updateItem não dispara toast 'Salvo' (já mostramos 'Item movido')
    updateItem.mutate({ id: itemId, silent: true, ...updateData } as any);
    toast.success('Item movido para ' + format(newDate, 'dd/MM'));
  }, [items, updateItem]);

  // ── Bulk actions (multi-select via shift-click) ─────────────────────────
  const lastClickedIdRef = useRef<string | null>(null);

  const handleCardClick = useCallback((item: PlanningItem, e: React.MouseEvent) => {
    // shift-click: range select. Como o Kanban tem ordem visual complexa
    // (várias colunas), implementamos range simples baseado no array `items`.
    if (e.shiftKey && lastClickedIdRef.current && lastClickedIdRef.current !== item.id) {
      const startIdx = items.findIndex(i => i.id === lastClickedIdRef.current);
      const endIdx = items.findIndex(i => i.id === item.id);
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
        const range = items.slice(from, to + 1).map(i => i.id);
        setSelectedIds(prev => {
          const next = new Set(prev);
          range.forEach(id => next.add(id));
          return next;
        });
        return;
      }
    }
    // cmd/ctrl-click ou já há seleção: toggle individual
    if (e.metaKey || e.ctrlKey || selectedIds.size > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      lastClickedIdRef.current = item.id;
      return;
    }
    lastClickedIdRef.current = item.id;
  }, [items, selectedIds.size]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // 2026-05-18 fix integração SV↔Planning↔Late: cron `process-scheduled-posts`
  // só pega itens com status='scheduled' AND scheduled_at <= now(). Quando o
  // user arrasta card pra coluna "Agendado" sem ter setado data antes (via
  // PlanningItemDialog), o item ficava preso indefinidamente sem nunca publicar.
  // Esta wrapper detecta esse caso, mostra warning e abre o dialog do PRIMEIRO
  // item afetado pro user definir scheduled_at. Os outros updates do batch
  // (reorder dentro da mesma coluna, movimentos pra colunas com data) seguem.
  const handleReorderWithScheduleGuard = useCallback(
    (updates: Array<{ id: string; column_id: string; position: number; status?: PlanningItem['status'] }>) => {
      const scheduledWithoutDate = updates.filter((u) => {
        if (u.status !== 'scheduled') return false;
        const item = items.find((i) => i.id === u.id);
        if (!item) return false;
        // Já tem data definida? Tudo certo, pode mover.
        if (item.scheduled_at) return false;
        // Item já estava no status 'scheduled'? Não é a transição que nos
        // interessa — só queremos pegar quem ENTROU na coluna agora sem data.
        if (item.status === 'scheduled') return false;
        return true;
      });
      reorderItems.mutate(updates);
      if (scheduledWithoutDate.length > 0) {
        const firstMissing = items.find((i) => i.id === scheduledWithoutDate[0].id);
        toast.warning(
          scheduledWithoutDate.length === 1
            ? 'Defina data de publicação pra agendar.'
            : `${scheduledWithoutDate.length} cards sem data — defina pra publicar.`,
          {
            description:
              'O cron só publica itens com scheduled_at preenchido. Abra o card e setta data + hora.',
            action: firstMissing
              ? {
                  label: 'Abrir card',
                  onClick: () => {
                    setEditingItem(firstMissing);
                    setDialogOpen(true);
                  },
                }
              : undefined,
            duration: 9000,
          },
        );
      }
    },
    [items, reorderItems],
  );

  const bulkMoveToColumn = useCallback(async (columnId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const column = columns.find(c => c.id === columnId);
    const columnType = column?.column_type;
    // Calcula posições incrementais a partir do final da coluna alvo
    const colItems = items.filter(i => i.column_id === columnId);
    let basePos = colItems.length > 0 ? Math.max(...colItems.map(i => i.position)) + 1 : 0;
    const updates = ids.map((id, i) => ({
      id,
      column_id: columnId,
      position: basePos + i,
      status: columnType ? (columnType as PlanningItem['status']) : undefined,
    }));
    // Usa o guard pra avisar se mover pra "Agendado" sem scheduled_at definido.
    handleReorderWithScheduleGuard(updates);
    toast.success(`${ids.length} ${ids.length === 1 ? 'card movido' : 'cards movidos'} pra ${column?.name ?? 'coluna'}`);
    clearSelection();
  }, [selectedIds, columns, items, handleReorderWithScheduleGuard, clearSelection]);

  const bulkAssign = useCallback(async (userId: string | null) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(
      ids.map(id => updateItem.mutateAsync({ id, assigned_to: userId, silent: true } as any)),
    );
    toast.success(`Responsável ${userId ? 'atribuído' : 'removido'} em ${ids.length} ${ids.length === 1 ? 'card' : 'cards'}`);
    clearSelection();
  }, [selectedIds, updateItem, clearSelection]);

  const bulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await Promise.all(ids.map(id => deleteItem.mutateAsync(id)));
    toast.success(`${ids.length} ${ids.length === 1 ? 'card excluído' : 'cards excluídos'}`);
    clearSelection();
  }, [selectedIds, deleteItem, clearSelection]);

  // Esc limpa seleção (quando há) ou fecha dialog (handled separately)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0 && !dialogOpen) {
        clearSelection();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds.size, dialogOpen, clearSelection]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  usePlanningKeyboardShortcuts({
    onNewItem: () => handleNewCard(),
    onCloseDialog: () => setDialogOpen(false),
    onSearch: () => filtersRef.current?.focusSearch(),
    onNavigate: (dir) => {
      if (view === 'board') kanbanRef.current?.moveFocus(dir);
    },
    onOpenFocused: () => {
      if (view === 'board') kanbanRef.current?.openFocused();
    },
    onShowHelp: () => setShowShortcutsHelp(true),
    isDialogOpen: dialogOpen,
  });

  const handleQuickRename = useCallback((id: string, title: string) => {
    // silent=true porque a UX inline já é o feedback
    updateItem.mutate({ id, title, silent: true } as any);
  }, [updateItem]);
  
  const showFilters = !(isViewer && viewerClientIds.length === 1);
  const isEmpty = items.length === 0;

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Carregando planejamento"
        className="h-full min-h-0 flex flex-col gap-3"
      >
        {/* Header skeleton */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-32" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
        {/* Filters skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
        {/* Board columns skeleton */}
        <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
        <span className="sr-only">Carregando planejamento…</span>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col gap-3">
      {/* Viewer Mode Banner */}
      {isViewer && (
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border border-border/50 rounded-lg text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          <span>Modo visualização — você pode criar e mover itens</span>
        </div>
      )}

      {/* Header */}
      <TabHeader
        eyebrow="Planejamento de conteúdo"
        icon={CalendarDays}
        title="Planejamento"
        description="Calendário editorial: ideias, drafts, aprovação e agendamento."
        actions={
          <>
            <ViewToggle view={view} onChange={setView} />
            {!isViewer && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowAutomations(!showAutomations)}
                      className={cn("h-9 w-9", showAutomations && 'bg-primary/10 text-primary')}
                      aria-label="Automações"
                      aria-pressed={showAutomations}
                    >
                      <Zap aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Automações</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowClickUpImport(true)}
                      className="h-9 w-9"
                      aria-label="Importar do ClickUp"
                    >
                      <Upload aria-hidden="true" className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Importar do ClickUp</TooltipContent>
                </Tooltip>
                <ViewSettingsPopover settings={settings} onChange={setSettings} />
                {view === 'board' && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowColumnsCustomize(true)}
                        className="h-9 w-9"
                        aria-label="Personalizar colunas"
                      >
                        <Columns3 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Personalizar colunas</TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowShortcutsHelp(true)}
                      className="h-9 w-9"
                      aria-label="Atalhos do teclado"
                    >
                      <Keyboard className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Atalhos</span>
                    <span className="ml-2 text-muted-foreground text-[10px]">?</span>
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={() => handleNewCard()} size="sm" className="h-9 gap-1.5 kai-btn-rec">
                      <Plus className="h-4 w-4" />
                      {!isMobile && <span>Novo</span>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <span>Novo item</span>
                    <span className="ml-2 text-muted-foreground text-[10px]">{getShortcutHint('N')}</span>
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </>
        }
      />

      {/* Filters */}
      {showFilters && (
        <FiltersComponent
          ref={filtersRef}
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
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'board' && (
          <KanbanView
            ref={kanbanRef}
            columns={columns}
            getItemsByColumn={getItemsByColumn}
            onEditItem={handleEdit}
            onDeleteItem={(id) => deleteItem.mutate(id)}
            onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
            onRetry={(id) => retryPublication.mutate(id)}
            onDuplicate={handleDuplicate}
            onQuickRename={!isViewer ? handleQuickRename : undefined}
            onMoveItem={(itemId, columnId, position) => moveToColumn.mutate({ itemId, columnId, newPosition: position })}
            onReorder={handleReorderWithScheduleGuard}
            onAddCard={(columnId) => handleNewCard(columnId)}
            canDelete={!isViewer}
            viewSettings={settings}
            memberMap={memberMap}
            selectedIds={selectedIds}
            onCardClick={!isViewer ? handleCardClick : undefined}
          />
        )}

        {view === 'calendar' && (
          <CalendarView
            items={items}
            onEditItem={handleEdit}
            onAddItem={(date) => handleNewCard(undefined, date)}
            onDeleteItem={(id) => deleteItem.mutateAsync(id)}
            onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
            onRetry={(id) => retryPublication.mutate(id)}
            onMoveItem={handleMoveToDate}
            canEdit={!isViewer}
            isDeleting={deleteItem.isPending}
            viewSettings={settings}
            memberMap={memberMap}
          />
        )}

        {view === 'list' && (
          <div className="h-full overflow-y-auto">
            {isEmpty ? (
              <EmptyState
                type="list"
                action={{
                  label: 'Criar primeiro item',
                  onClick: () => handleNewCard(),
                }}
              />
            ) : (
              <div className="border border-border/50 rounded-lg overflow-hidden bg-card">
                {/* Table header */}
                <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-b border-border/50 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <div className="w-5" />
                  <div className="flex-1">Título</div>
                  <div className="w-[100px] hidden lg:block">Cliente</div>
                  <div className="w-[80px] hidden md:block">Redes</div>
                  <div className="w-[90px] hidden sm:block">Data</div>
                  <div className="w-[90px]">Status</div>
                  <div className="w-6 hidden lg:block" />
                  <div className="w-7" />
                </div>
                {items.map(item => (
                  <PlanningListRow
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onDelete={(id) => deleteItem.mutate(id)}
                    onMoveToLibrary={(id) => moveToLibrary.mutate(id)}
                    onRetry={(id) => retryPublication.mutate(id)}
                    onDuplicate={handleDuplicate}
                    canDelete={!isViewer}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'editorial' && (
          <div className="h-full overflow-y-auto">
            {effectiveFilters.clientId ? (
              <Suspense fallback={<div className="p-8"><Skeleton className="h-96" /></div>}>
                <MetricoolCalendarView
                  clientId={effectiveFilters.clientId}
                  onCreatePlanningItem={(date, eventTitle) =>
                    handleNewCard(undefined, date, eventTitle)
                  }
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-full p-8">
                <div className="text-center max-w-md">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
                  <h3 className="text-base font-semibold mb-1">Calendário Editorial</h3>
                  <p className="text-sm text-muted-foreground">
                    Selecione um cliente acima pra ver datas comemorativas, holidays e
                    eventos do nicho (em migração pro Late/Zernio).
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialog — só monta quando aberto pra evitar baixar o chunk antes
          do user clicar em criar/editar planning item. */}
      {dialogOpen && (
        <Suspense fallback={null}>
          <PlanningItemDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            item={editingItem}
            columns={columns}
            defaultColumnId={defaultColumnId}
            defaultDate={defaultDate}
            defaultClientId={localFilters.clientId || clientId}
            defaultTitle={defaultTitle}
            onSave={handleCreateItem}
            onUpdate={handleUpdateItem}
            onDelete={isViewer ? undefined : async (id) => { await deleteItem.mutateAsync(id); }}
          />
        </Suspense>
      )}

      {/* ClickUp Import */}
      {showClickUpImport && (
        <Suspense fallback={null}>
          <ClickUpImportDialog
            open={showClickUpImport}
            onOpenChange={setShowClickUpImport}
          />
        </Suspense>
      )}

      {/* Modal de atalhos de teclado */}
      {showShortcutsHelp && (
        <Suspense fallback={null}>
          <KeyboardShortcutsDialog
            open={showShortcutsHelp}
            onOpenChange={setShowShortcutsHelp}
          />
        </Suspense>
      )}

      {/* Personalizar colunas do Kanban */}
      {showColumnsCustomize && (
        <Suspense fallback={null}>
          <ColumnsCustomizeDialog
            open={showColumnsCustomize}
            onOpenChange={setShowColumnsCustomize}
            columns={columns}
          />
        </Suspense>
      )}

      {/* Toolbar flutuante de ações em massa */}
      {!isViewer && (
        <BulkActionsToolbar
          selectedCount={selectedIds.size}
          columns={columns}
          members={members}
          onMoveToColumn={bulkMoveToColumn}
          onAssignTo={bulkAssign}
          onDelete={bulkDelete}
          onClear={clearSelection}
          canDelete={!isViewer}
        />
      )}
    </div>
  );
}

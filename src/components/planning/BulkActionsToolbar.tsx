import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight, Trash2, X, MoveRight, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KanbanColumn } from '@/hooks/usePlanningItems';

interface BulkActionsToolbarProps {
  selectedCount: number;
  columns: KanbanColumn[];
  members?: Array<{ user_id: string; profile?: { full_name?: string | null; email?: string | null } | null }>;
  onMoveToColumn: (columnId: string) => void;
  onAssignTo: (userId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
  canDelete?: boolean;
}

/**
 * Toolbar flutuante de ações em massa. Aparece no rodapé quando há cards
 * selecionados via shift-click no Kanban.
 */
export function BulkActionsToolbar({
  selectedCount,
  columns,
  members,
  onMoveToColumn,
  onAssignTo,
  onDelete,
  onClear,
  canDelete = true,
}: BulkActionsToolbarProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Ordena colunas por position pra UX consistente.
  const sortedColumns = useMemo(
    () => [...columns].sort((a, b) => a.position - b.position),
    [columns],
  );

  if (selectedCount === 0) return null;

  return (
    <>
      <div
        className={cn(
          'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
          'flex items-center gap-1.5 px-3 py-2 rounded-full',
          'bg-foreground text-background shadow-lg border border-border/40',
          'animate-in slide-in-from-bottom-4 duration-200',
        )}
        role="toolbar"
        aria-label={`Ações em massa — ${selectedCount} selecionados`}
      >
        <span className="text-xs font-medium pr-2 pl-1 tabular-nums">
          {selectedCount} {selectedCount === 1 ? 'selecionado' : 'selecionados'}
        </span>

        <div className="h-4 w-px bg-background/20" />

        {/* Mover pra coluna */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-background hover:bg-background/10 hover:text-background gap-1.5 rounded-full"
            >
              <MoveRight className="h-3.5 w-3.5" />
              Mover
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Mover pra coluna
            </DropdownMenuLabel>
            {sortedColumns.map((col) => (
              <DropdownMenuItem
                key={col.id}
                onClick={() => onMoveToColumn(col.id)}
                className="text-xs gap-2"
              >
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                {col.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Atribuir */}
        {members && members.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-background hover:bg-background/10 hover:text-background gap-1.5 rounded-full"
              >
                <UserCircle className="h-3.5 w-3.5" />
                Atribuir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-56">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Atribuir responsável
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => onAssignTo(null)} className="text-xs text-muted-foreground">
                Remover responsável
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {members.map((m) => (
                <DropdownMenuItem
                  key={m.user_id}
                  onClick={() => onAssignTo(m.user_id)}
                  className="text-xs"
                >
                  {m.profile?.full_name || m.profile?.email || 'Membro'}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Excluir */}
        {canDelete && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="h-7 px-2 text-xs text-destructive hover:bg-destructive/20 hover:text-destructive gap-1.5 rounded-full"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </Button>
        )}

        <div className="h-4 w-px bg-background/20" />

        {/* Limpar seleção */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onClear}
          className="h-7 w-7 text-background/80 hover:bg-background/10 hover:text-background rounded-full"
          aria-label="Limpar seleção"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Confirmação de exclusão em massa */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedCount} {selectedCount === 1 ? 'card' : 'cards'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita em massa. Cards individuais podem ser
              restaurados via toast logo após a exclusão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete();
                setConfirmDelete(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

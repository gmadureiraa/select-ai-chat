import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { GripVertical, Pencil, Plus, Trash2, X, Check, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlanningColumns } from '@/hooks/usePlanningColumns';
import type { KanbanColumn } from '@/hooks/usePlanningItems';

interface ColumnsCustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
}

/**
 * Dialog pra customizar as colunas do Kanban:
 *  - Renomear (nome livre, column_type fica fixo)
 *  - Reordenar (drag em desktop, setinhas como fallback)
 *  - Adicionar coluna custom
 *  - Remover coluna custom (default não pode ser removida)
 */
export function ColumnsCustomizeDialog({ open, onOpenChange, columns }: ColumnsCustomizeDialogProps) {
  const { renameColumn, reorderColumns, addCustomColumn, deleteColumn } = usePlanningColumns();

  // Estado local com ordem otimista pra reordenação suave
  const [localCols, setLocalCols] = useState<KanbanColumn[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [newColumnName, setNewColumnName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalCols([...columns].sort((a, b) => a.position - b.position));
    }
  }, [open, columns]);

  const handleStartEdit = (col: KanbanColumn) => {
    setEditingId(col.id);
    setEditingValue(col.name);
  };

  const handleCommitEdit = () => {
    if (!editingId) return;
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const original = localCols.find(c => c.id === editingId);
    if (original && trimmed !== original.name) {
      renameColumn.mutate({ id: editingId, name: trimmed });
      setLocalCols(prev => prev.map(c => (c.id === editingId ? { ...c, name: trimmed } : c)));
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const move = (id: string, dir: 'up' | 'down') => {
    const idx = localCols.findIndex(c => c.id === id);
    if (idx === -1) return;
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= localCols.length) return;
    const next = [...localCols];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setLocalCols(next);
    // Persiste com positions reindexadas
    reorderColumns.mutate(next.map((c, i) => ({ id: c.id, position: i })));
  };

  const handleDragStart = (id: string) => setDraggedId(id);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }
    const fromIdx = localCols.findIndex(c => c.id === draggedId);
    const toIdx = localCols.findIndex(c => c.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...localCols];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setLocalCols(next);
    reorderColumns.mutate(next.map((c, i) => ({ id: c.id, position: i })));
    setDraggedId(null);
  };

  const handleAddColumn = () => {
    const trimmed = newColumnName.trim();
    if (!trimmed) return;
    addCustomColumn.mutate(
      { name: trimmed, position: localCols.length },
      {
        onSuccess: () => setNewColumnName(''),
      },
    );
  };

  const handleDelete = (col: KanbanColumn) => {
    if (col.is_default || col.column_type !== 'custom') return;
    if (!confirm(`Remover coluna "${col.name}"? Cards serão movidos pra "Ideias".`)) return;
    deleteColumn.mutate(col.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Personalizar colunas do board</DialogTitle>
          <DialogDescription>
            Renomeie, reordene (arraste ou setas) ou adicione colunas customizadas.
            Colunas padrão não podem ser removidas — só renomeadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2 max-h-[50vh] overflow-y-auto">
          {localCols.map((col, i) => {
            const isDefault = col.is_default || (col.column_type !== null && col.column_type !== 'custom');
            const isEditing = editingId === col.id;
            return (
              <div
                key={col.id}
                draggable={!isEditing}
                onDragStart={() => handleDragStart(col.id)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(col.id)}
                className={cn(
                  'group flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/40 bg-card',
                  'hover:bg-muted/40 transition-colors',
                  draggedId === col.id && 'opacity-40',
                )}
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 cursor-grab" />

                {isEditing ? (
                  <Input
                    autoFocus
                    value={editingValue}
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={handleCommitEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCommitEdit();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        handleCancelEdit();
                      }
                    }}
                    className="h-7 text-sm flex-1"
                    maxLength={40}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStartEdit(col)}
                    className="flex-1 text-left text-sm truncate hover:text-primary transition-colors"
                    title="Clique pra renomear"
                  >
                    {col.name}
                  </button>
                )}

                {isDefault && !isEditing && (
                  <Lock
                    className="h-3 w-3 text-muted-foreground/60 shrink-0"
                    aria-label="Coluna padrão (não removível)"
                  />
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isEditing && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={i === 0}
                        onClick={() => move(col.id, 'up')}
                        aria-label="Mover pra cima"
                      >
                        <span className="text-xs leading-none">↑</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        disabled={i === localCols.length - 1}
                        onClick={() => move(col.id, 'down')}
                        aria-label="Mover pra baixo"
                      >
                        <span className="text-xs leading-none">↓</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleStartEdit(col)}
                        aria-label="Renomear"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      {!isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(col)}
                          aria-label="Remover coluna"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  )}
                  {isEditing && (
                    <>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCommitEdit}>
                        <Check className="h-3 w-3 text-emerald-500" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add custom column */}
        <div className="border-t border-border/50 pt-3">
          <h4 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
            Nova coluna customizada
          </h4>
          <div className="flex gap-2">
            <Input
              placeholder="Ex: Em produção, Aguardando cliente…"
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddColumn();
                }
              }}
              maxLength={40}
              className="h-8 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddColumn}
              disabled={!newColumnName.trim() || addCustomColumn.isPending}
              className="h-8 gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

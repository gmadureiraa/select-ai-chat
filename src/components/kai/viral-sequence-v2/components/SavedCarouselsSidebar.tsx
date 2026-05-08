/**
 * SavedCarouselsSidebar v2 — lista carrosséis salvos do cliente.
 *
 * Click → abre o carrossel pra edição. "+ Novo" → reseta state pra um carrossel
 * vazio.
 */

import { Plus, Trash2, Loader2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";
import { useSavedCarousels, useDeleteCarousel } from "../hooks/useSavedCarousels";

interface SavedCarouselsSidebarProps {
  clientId: string;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function SavedCarouselsSidebar({
  clientId,
  currentId,
  onSelect,
  onNew,
}: SavedCarouselsSidebarProps) {
  const { data: carousels, isLoading, error } = useSavedCarousels(clientId);
  const deleteMut = useDeleteCarousel(clientId);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteMut.mutateAsync(id);
      toast.success("Carrossel removido");
      if (currentId === id) onNew();
    } catch (err) {
      toast.error(`Falha ao remover: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <aside className="w-[260px] border-r border-border/40 bg-card/30 flex flex-col h-full shrink-0">
      <div className="p-3 border-b border-border/30">
        <Button
          onClick={onNew}
          size="sm"
          className="w-full gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo carrossel
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          <FileText className="h-3 w-3" />
          Salvos · {carousels?.length ?? 0}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {error && (
          <div className="px-2 py-3 text-xs text-destructive">
            Falha ao carregar. {String((error as Error).message)}
          </div>
        )}

        {!isLoading && carousels?.length === 0 && (
          <div className="px-2 py-6 text-center text-xs text-muted-foreground">
            Nenhum carrossel salvo ainda.
          </div>
        )}

        {carousels?.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group relative flex items-start gap-2 rounded-md px-2 py-2 cursor-pointer transition-colors",
              currentId === c.id
                ? "bg-sky-500/10 ring-1 ring-sky-500/30"
                : "hover:bg-muted/50",
            )}
            onClick={() => onSelect(c.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{c.title}</div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                {c.template} · {c.slidesCount} slides · {c.status}
              </div>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1"
                  disabled={deletingId === c.id}
                >
                  {deletingId === c.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remover carrossel?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Essa ação não pode ser desfeita. "{c.title}" será removido permanentemente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDelete(c.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Remover
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
      </div>
    </aside>
  );
}

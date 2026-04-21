/**
 * Sidebar lateral colapsável com a lista de carrosséis salvos do cliente.
 * - Lista usando `listSavedCarousels(clientId)`
 * - Click → carrega via `loadCarousel(id)` e atualiza URL param
 * - Delete inline (com confirmação)
 * - Botão "Novo" → limpa estado e zera URL
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2,
  Plus,
  Trash2,
  FileImage,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  listSavedCarousels,
  deleteCarousel,
  type SavedCarouselSummary,
} from "./storage";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SavedCarouselsSidebarProps {
  clientId: string;
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  refreshKey?: number;
}

export function SavedCarouselsSidebar({
  clientId,
  currentId,
  onSelect,
  onNew,
  refreshKey = 0,
}: SavedCarouselsSidebarProps) {
  const [items, setItems] = useState<SavedCarouselSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [, setSearchParams] = useSearchParams();

  useEffect(() => {
    let canceled = false;
    setLoading(true);
    listSavedCarousels(clientId)
      .then((data) => {
        if (!canceled) setItems(data);
      })
      .catch((err) => {
        if (!canceled) {
          console.error("[SavedCarouselsSidebar] load failed:", err);
          toast.error("Falha ao carregar carrosséis salvos");
        }
      })
      .finally(() => !canceled && setLoading(false));
    return () => {
      canceled = true;
    };
  }, [clientId, refreshKey]);

  const handleDelete = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Excluir carrossel "${title}"? Esta ação não pode ser desfeita.`)) return;
    try {
      await deleteCarousel(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast.success("Carrossel excluído");
      if (currentId === id) {
        // Sai do carrossel atual
        setSearchParams((sp) => {
          const next = new URLSearchParams(sp);
          next.delete("carouselId");
          return next;
        });
        onNew();
      }
    } catch (err) {
      console.error("[SavedCarouselsSidebar] delete failed:", err);
      toast.error("Falha ao excluir");
    }
  };

  if (collapsed) {
    return (
      <div className="border-r border-border/30 bg-muted/10 w-10 flex flex-col items-center py-3 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCollapsed(false)}
          title="Expandir lista de carrosséis"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <FileImage className="h-4 w-4 text-muted-foreground mt-2" />
      </div>
    );
  }

  return (
    <div className="border-r border-border/30 bg-muted/5 w-64 flex flex-col shrink-0">
      <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5">
        <FileImage className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Salvos
        </span>
        <span className="text-[10px] text-muted-foreground/70 ml-1">
          ({items.length})
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-auto"
          onClick={() => setCollapsed(true)}
          title="Recolher"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5 h-8 text-xs"
          onClick={onNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Novo carrossel
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-6 px-2 leading-relaxed">
            Nenhum carrossel salvo ainda. Gere um e clique em "Salvar".
          </p>
        ) : (
          items.map((it) => (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              className={cn(
                "group w-full text-left px-2 py-1.5 rounded-md transition-all",
                "hover:bg-muted/50",
                currentId === it.id && "bg-sky-100/60 dark:bg-sky-900/30",
              )}
            >
              <div className="flex items-start justify-between gap-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium truncate">{it.title}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                    <span>{it.slidesCount} slides</span>
                    <span>·</span>
                    <span
                      className={cn(
                        "uppercase font-mono",
                        it.status === "published" && "text-emerald-600",
                        it.status === "draft" && "text-muted-foreground",
                      )}
                    >
                      {it.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {format(parseISO(it.updatedAt), "dd MMM HH:mm", { locale: ptBR })}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, it.id, it.title)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="Excluir"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

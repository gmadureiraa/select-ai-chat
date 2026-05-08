/**
 * HistorySidebar — sidebar com histórico de reels adaptados pro client.
 * Lista os roteiros + permite selecionar um pra ver detalhes ou deletar.
 */

import { History, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ReelRow } from "../types";

interface Props {
  reels: ReelRow[];
  selectedId: string | null;
  onSelect: (reel: ReelRow) => void;
  onDelete: (id: string) => void;
  loading?: boolean;
}

export function HistorySidebar({
  reels,
  selectedId,
  onSelect,
  onDelete,
  loading,
}: Props) {
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-card/30 flex flex-col">
      <div className="p-3 border-b border-border flex items-center gap-2">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Histórico</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {reels.length}
        </Badge>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              Carregando…
            </p>
          )}
          {!loading && reels.length === 0 && (
            <p className="text-xs text-muted-foreground p-3 text-center">
              Nenhum roteiro ainda. Cola um link de Reel pra começar.
            </p>
          )}
          {reels.map((r) => (
            <div
              key={r.id}
              className={cn(
                "group rounded-md transition-colors",
                selectedId === r.id ? "bg-accent" : "hover:bg-accent/50",
              )}
            >
              <button
                onClick={() => onSelect(r)}
                className="w-full text-left p-2.5 text-xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {r.script?.titulo || r.tema}
                    </p>
                    <p className="text-muted-foreground truncate mt-0.5">
                      @{r.source_meta?.ownerUsername ?? "—"} · {r.objetivo}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge
                      variant={
                        r.status === "done"
                          ? "default"
                          : r.status === "error"
                            ? "destructive"
                            : "secondary"
                      }
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                  </div>
                </div>
              </button>
              <div className="px-2 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] w-full justify-start text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("Excluir este roteiro?")) onDelete(r.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 mr-1.5" />
                  Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

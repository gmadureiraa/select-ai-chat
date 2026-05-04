/**
 * Tab Tendências — Google Trends BR (top searches do dia).
 * Mostra termos em alta + permite "Salvar como ideia" e "Usar como prompt".
 */
import { useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, ExternalLink, Lightbulb, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TrendItem {
  title: string;
  traffic: string;
  pubDate: string;
  picture?: string;
  link?: string;
}

interface Props {
  clientId: string;
  workspaceId?: string;
  onUseAsInspiration?: (prompt: string) => void;
}

export function TabTrends({ clientId, workspaceId, onUseAsInspiration }: Props) {
  const [items, setItems] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-trends-br", { body: {} });
      if (error) throw error;
      setItems((data?.items ?? []) as TrendItem[]);
      setUpdatedAt(new Date());
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao carregar tendências");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function saveIdea(t: TrendItem) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("planning_items").insert([{
        client_id: clientId,
        workspace_id: workspaceId,
        title: t.title,
        content: `Tendência Google BR · ${t.traffic ?? "—"} buscas\n${t.link ?? ""}`,
        status: "idea",
        platform: "instagram",
        created_by: u.user!.id,
      }]);
      if (error) throw error;
      toast.success("Ideia salva no Planning");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Tendências do dia · Brasil
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Top buscas no Google Trends BR. {updatedAt && `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR")}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          Atualizar
        </Button>
      </div>

      {loading && items.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Carregando…
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Nenhuma tendência disponível.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {items.map((t, i) => (
          <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{t.title}</div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                {t.traffic && <Badge variant="secondary" className="text-[10px]">{t.traffic} buscas</Badge>}
                {t.pubDate && <span>{new Date(t.pubDate).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onUseAsInspiration && (
                <Button size="sm" variant="ghost" onClick={() => onUseAsInspiration(`Crie um conteúdo conectando o nicho do cliente com o tema em alta hoje no Brasil: "${t.title}"`)}>
                  <Sparkles className="h-3 w-3" />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => saveIdea(t)} title="Salvar como ideia">
                <Lightbulb className="h-3 w-3" />
              </Button>
              {t.link && (
                <a href={t.link} target="_blank" rel="noreferrer" className="p-1.5 hover:bg-accent rounded">
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

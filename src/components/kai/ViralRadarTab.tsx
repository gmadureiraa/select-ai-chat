/**
 * Radar Viral — briefing diário de inteligência por cliente.
 *
 * Agrega notícias (Google News), YouTube top-views e posts top do próprio
 * cliente, e usa Gemini pra gerar:
 *   - narrativas dominantes
 *   - hot topics
 *   - ideias de carrossel prontas
 *   - cross-pollination (tópicos que aparecem em múltiplas fontes)
 *
 * Adaptado de github.com/gmadureiraa/radar-viral.
 */

import { useEffect, useState } from "react";
import { Loader2, Radar as RadarIcon, RefreshCw, Sparkles, Flame, Lightbulb, Layers, ExternalLink, AlertTriangle, History, Clock, Film, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Client } from "@/hooks/useClients";

interface RadarBriefRow {
  id: string;
  niche: string;
  brief_date: string;
  narratives: any[] | null;
  hot_topics: any[] | null;
  carousel_ideas: any[] | null;
  cross_pollination: any[] | null;
  sources_summary: any;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_at: string;
  cost_usd: number | null;
}

interface ViralRadarTabProps {
  clientId: string;
  client: Client;
}

export function ViralRadarTab({ clientId, client }: ViralRadarTabProps) {
  const [generating, setGenerating] = useState(false);
  const [briefs, setBriefs] = useState<RadarBriefRow[]>([]);
  const [selected, setSelected] = useState<RadarBriefRow | null>(null);
  const navigate = useNavigate();

  async function loadBriefs() {
    const { data, error } = await supabase
      .from("viral_radar_briefs")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) { console.error(error); return; }
    const rows = (data ?? []) as RadarBriefRow[];
    setBriefs(rows);
    if (rows.length > 0 && !selected) setSelected(rows[0]);
  }

  useEffect(() => { loadBriefs(); /* eslint-disable-next-line */ }, [clientId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-radar-brief", {
        body: { clientId, niche: (client as any)?.industry ?? "general" },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha");
      toast.success("Briefing gerado!");
      await loadBriefs();
      const fresh = await supabase
        .from("viral_radar_briefs").select("*").eq("id", data.briefId).single();
      if (fresh.data) setSelected(fresh.data as RadarBriefRow);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao gerar briefing");
    } finally {
      setGenerating(false);
    }
  }

  function handleUseAsCarousel(idea: { hook: string; angle: string }) {
    const params = new URLSearchParams({
      client: clientId,
      tab: "sequence",
      prompt: `Tema: ${idea.hook}\n\nÂngulo: ${idea.angle}`,
    });
    navigate(`/${(client as any)?.workspace_slug ?? ""}?${params.toString()}`);
  }

  function handleUseAsReel(topic: string, summary?: string) {
    const params = new URLSearchParams({
      client: clientId,
      tab: "reels",
      tema: topic,
      ...(summary ? { briefing: summary } : {}),
    });
    navigate(`/${(client as any)?.workspace_slug ?? ""}?${params.toString()}`);
  }

  async function handleSaveAsIdea(topic: string, source: string) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("planning_items").insert([{
        client_id: clientId,
        workspace_id: (client as any).workspace_id,
        title: topic,
        content: `Ideia do Radar Viral · fonte: ${source}`,
        status: "idea",
        platform: "instagram",
        created_by: u.user!.id,
      }]);
      if (error) throw error;
      toast.success("Salvo como ideia no Planning");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar histórico */}
      <aside className="w-72 border-r border-border bg-card/30 flex flex-col">
        <div className="p-3 border-b border-border flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Briefings</span>
          <Badge variant="secondary" className="ml-auto text-xs">{briefs.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {briefs.length === 0 && (
              <p className="text-xs text-muted-foreground p-3 text-center">
                Nenhum briefing ainda. Gere o primeiro.
              </p>
            )}
            {briefs.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className={cn(
                  "w-full text-left p-2.5 rounded-md text-xs hover:bg-accent/50 transition-colors",
                  selected?.id === b.id && "bg-accent",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{new Date(b.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    <p className="text-muted-foreground truncate mt-0.5">
                      {b.niche} · {b.narratives?.length ?? 0} narrativas
                    </p>
                  </div>
                  <Badge
                    variant={b.status === "done" ? "default" : b.status === "error" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {b.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RadarIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-semibold">Radar Viral</h1>
              <Badge variant="outline" className="text-xs">Briefing diário · {client.name}</Badge>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Agregando sinais…</>
                : <><RefreshCw className="h-4 w-4 mr-2" /> Gerar briefing agora</>}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground -mt-3">
            Agrega notícias (Google News), YouTube top-views, posts top do cliente e devolve narrativas, tópicos quentes e ideias prontas pra carrossel.
          </p>

          {!selected && !generating && (
            <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
              <RadarIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p className="mb-1">Sem briefing ainda.</p>
              <p className="text-xs">Cadastre keywords no <strong>Viral Hunter</strong> e clique em "Gerar briefing agora".</p>
            </div>
          )}

          {selected?.status === "error" && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">Falha ao gerar briefing</p>
                <p className="text-xs mt-1 opacity-90">{selected.error_message}</p>
              </div>
            </div>
          )}

          {selected?.status === "done" && (
            <>
              <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(selected.created_at).toLocaleString("pt-BR")}</span>
                <span>·</span>
                <span>📰 {selected.sources_summary?.news_count ?? 0} notícias</span>
                <span>🎬 {selected.sources_summary?.youtube_count ?? 0} vídeos YT</span>
                <span>📸 {selected.sources_summary?.own_posts_count ?? 0} posts próprios</span>
                {selected.cost_usd != null && <><span>·</span><span>${Number(selected.cost_usd).toFixed(4)}</span></>}
              </div>

              {/* Narrativas */}
              <Section title="Narrativas dominantes" icon={Sparkles}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selected.narratives?.map((n: any, i: number) => (
                    <div key={i} className="rounded-lg border border-border bg-card p-4">
                      <div className="text-sm font-medium mb-1">{n.title}</div>
                      <p className="text-xs text-muted-foreground mb-2">{n.why}</p>
                      <div className="flex flex-wrap gap-1">
                        {n.signals?.map((s: string, j: number) => (
                          <Badge key={j} variant="secondary" className="text-[10px]">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Hot Topics */}
              <Section title="Hot topics" icon={Flame}>
                <div className="space-y-1.5">
                  {selected.hot_topics?.map((t: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 rounded-md border border-border bg-card p-3">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold">
                        {t.signal_count}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{t.topic}</div>
                        <div className="text-xs text-muted-foreground">{t.source_summary}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleSaveAsIdea(t.topic, t.source_summary)}>
                        <Lightbulb className="h-3 w-3 mr-1" /> Ideia
                      </Button>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Carousel Ideas */}
              <Section title="Ideias prontas pra carrossel" icon={Layers}>
                <div className="space-y-2">
                  {selected.carousel_ideas?.map((c: any, i: number) => (
                    <div key={i} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                      <div className="text-sm font-semibold mb-1">{c.hook}</div>
                      <p className="text-xs text-muted-foreground mb-3">{c.angle}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleUseAsCarousel(c)}>
                          <Layers className="h-3 w-3 mr-1.5" /> Virar carrossel
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleSaveAsIdea(c.hook, "Radar · carousel idea")}>
                          <Lightbulb className="h-3 w-3 mr-1.5" /> Salvar ideia
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Cross-pollination */}
              {selected.cross_pollination && selected.cross_pollination.length > 0 && (
                <Section title="Cross-pollination (sinal forte)" icon={ExternalLink}>
                  <div className="space-y-1.5">
                    {selected.cross_pollination.map((cp: any, i: number) => (
                      <div key={i} className="text-sm rounded-md border border-border bg-card p-3">
                        <div className="font-medium">{cp.topic}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Aparece em: {cp.sources?.join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-2 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" /> {title}
      </h2>
      {children}
    </section>
  );
}

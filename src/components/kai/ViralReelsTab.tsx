/**
 * Reels Viral — engenharia reversa de Reels do Instagram.
 *
 * Fluxo:
 *   1. User cola link de Reel + briefing (tema/objetivo/CTA)
 *   2. Edge function `adapt-viral-reel` faz scrape Apify → Gemini File API
 *   3. Retorna análise (porque viralizou + estrutura) + roteiro novo cena-a-cena
 *   4. Resultado fica salvo em viral_reels (vinculado ao client_id)
 *
 * Adaptado de github.com/gmadureiraa/reels-viral.
 */

import { useEffect, useState } from "react";
import { Loader2, Film, Wand2, History, Trash2, Eye, Copy, ExternalLink, Lightbulb, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";
import type { Client } from "@/hooks/useClients";

interface ViralReelsTabProps {
  clientId: string;
  client: Client;
}

interface ReelRow {
  id: string;
  source_url: string;
  source_short_code: string | null;
  tema: string;
  objetivo: string;
  cta: string;
  persona: string | null;
  nicho: string | null;
  source_meta: any;
  analysis: any;
  script: any;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  created_at: string;
}

const OBJETIVOS = [
  { value: "leads", label: "Leads" },
  { value: "produto", label: "Vender produto" },
  { value: "seguidores", label: "Ganhar seguidores" },
  { value: "engajamento", label: "Engajamento" },
];

export function ViralReelsTab({ clientId, client }: ViralReelsTabProps) {
  const [sourceUrl, setSourceUrl] = useState("");
  const [tema, setTema] = useState("");
  const [objetivo, setObjetivo] = useState("engajamento");
  const [cta, setCta] = useState("");
  const [persona, setPersona] = useState("");
  const [nicho, setNicho] = useState("");
  const [generating, setGenerating] = useState(false);
  const [reels, setReels] = useState<ReelRow[]>([]);
  const [selected, setSelected] = useState<ReelRow | null>(null);

  // Load history
  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("viral_reels")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!active) return;
      if (error) {
        console.error("Erro carregando reels:", error);
        return;
      }
      setReels((data ?? []) as ReelRow[]);
      if (data && data.length > 0 && !selected) setSelected(data[0] as ReelRow);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // Pre-fill nicho com industry do client
  useEffect(() => {
    if (!nicho && (client as any)?.industry) setNicho((client as any).industry);
  }, [client, nicho]);

  async function handleGenerate() {
    if (!sourceUrl.trim() || !tema.trim() || !cta.trim()) {
      toast.error("Preencha link do Reel, tema e CTA.");
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("adapt-viral-reel", {
        body: {
          clientId,
          sourceUrl: sourceUrl.trim(),
          tema: tema.trim(),
          objetivo,
          cta: cta.trim(),
          persona: persona.trim() || undefined,
          nicho: nicho.trim() || undefined,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Falha desconhecida");

      toast.success("Roteiro gerado!");

      // Refresh list
      const { data: fresh } = await supabase
        .from("viral_reels")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (fresh) {
        setReels(fresh as ReelRow[]);
        const found = (fresh as ReelRow[]).find((r) => r.id === data.reelId);
        if (found) setSelected(found);
      }

      // Limpa form básico
      setSourceUrl("");
      setTema("");
      setCta("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? "Erro ao gerar roteiro.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este roteiro?")) return;
    const { error } = await supabase.from("viral_reels").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir.");
      return;
    }
    setReels((prev) => prev.filter((r) => r.id !== id));
    if (selected?.id === id) setSelected(null);
  }

  function copyText(label: string, text: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  }

  async function saveAsIdea(reel: ReelRow) {
    try {
      const { data: u } = await supabase.auth.getUser();
      const title = reel.script?.titulo ?? reel.tema;
      const body = [
        `Roteiro adaptado do reel @${reel.source_meta?.ownerUsername ?? "—"}`,
        reel.source_url,
        "",
        `Hook: ${reel.script?.hook ?? ""}`,
        "",
        reel.script?.roteiroCompleto ?? "",
      ].join("\n");
      const { error } = await supabase.from("planning_items").insert([{
        client_id: clientId,
        workspace_id: (client as any).workspace_id,
        title,
        content: body,
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

  async function saveToLibrary(reel: ReelRow) {
    try {
      const title = reel.script?.titulo ?? reel.tema;
      const content = [
        `# ${title}`,
        ``,
        `**Hook:** ${reel.script?.hook ?? ""}`,
        ``,
        `## Roteiro completo`,
        reel.script?.roteiroCompleto ?? "",
        ``,
        `## Caption sugerida`,
        reel.script?.captionSugerida ?? "",
        ``,
        `## Cenas`,
        ...(reel.script?.scenes ?? []).map((s: any) => `- #${s.n} (${s.tempo}) [${s.papel}] ${s.copy}`),
        ``,
        `Fonte: ${reel.source_url} (@${reel.source_meta?.ownerUsername ?? "—"})`,
      ].join("\n");
      const { error } = await supabase.from("client_content_library").insert([{
        client_id: clientId,
        title,
        content,
        content_type: "reel_script",
        metadata: {
          source: "viral-reels",
          reelId: reel.id,
          sourceUrl: reel.source_url,
          ownerUsername: reel.source_meta?.ownerUsername,
          objetivo: reel.objetivo,
          cta: reel.cta,
        },
      }]);
      if (error) throw error;
      toast.success("Salvo na Library");
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
          <span className="text-sm font-medium">Histórico</span>
          <Badge variant="secondary" className="ml-auto text-xs">{reels.length}</Badge>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {reels.length === 0 && (
              <p className="text-xs text-muted-foreground p-3 text-center">
                Nenhum roteiro ainda.
              </p>
            )}
            {reels.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className={cn(
                  "w-full text-left p-2.5 rounded-md text-xs hover:bg-accent/50 transition-colors group",
                  selected?.id === r.id && "bg-accent",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.script?.titulo || r.tema}</p>
                    <p className="text-muted-foreground truncate mt-0.5">
                      @{r.source_meta?.ownerUsername ?? "—"} · {r.objetivo}
                    </p>
                  </div>
                  <Badge
                    variant={r.status === "done" ? "default" : r.status === "error" ? "destructive" : "secondary"}
                    className="text-[10px] shrink-0"
                  >
                    {r.status}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Conteúdo principal */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <div className="flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Reels Viral</h1>
            <Badge variant="outline" className="ml-2 text-xs">Engenharia reversa</Badge>
          </div>
          <p className="text-sm text-muted-foreground -mt-3">
            Cola o link de um Reel viral, descreve seu briefing, e a IA replica a estrutura narrativa exata
            adaptada ao seu conteúdo.
          </p>

          {/* Form */}
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <div>
              <Label className="text-xs">Link do Reel original (Instagram)</Label>
              <Input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/..."
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Tema do seu reel</Label>
                <Textarea
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="Ex: como começar a investir em DeFi com pouco dinheiro"
                  className="mt-1 h-20"
                />
              </div>
              <div>
                <Label className="text-xs">CTA final</Label>
                <Textarea
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Ex: comenta 'DEFI' que mando o guia gratuito"
                  className="mt-1 h-20"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Objetivo</Label>
                <Select value={objetivo} onValueChange={setObjetivo}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBJETIVOS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Persona (opcional)</Label>
                <Input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="Ex: investidor iniciante" className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Nicho (opcional)</Label>
                <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: cripto" className="mt-1" />
              </div>
            </div>
            <Button onClick={handleGenerate} disabled={generating} className="w-full">
              {generating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Adaptando reel… (~30-60s)</>
              ) : (
                <><Wand2 className="h-4 w-4 mr-2" /> Gerar roteiro adaptado</>
              )}
            </Button>
          </div>

          {/* Resultado */}
          {selected && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold truncate">
                    {selected.script?.titulo || selected.tema}
                  </h2>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <a
                      href={selected.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver reel original (@{selected.source_meta?.ownerUsername ?? "—"})
                    </a>
                    <span>·</span>
                    <span>{selected.source_meta?.videoPlayCount?.toLocaleString() ?? "—"} views</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => saveAsIdea(selected)} title="Salvar como ideia no Planning">
                  <Lightbulb className="h-4 w-4 mr-1" /> Ideia
                </Button>
                <Button variant="ghost" size="sm" onClick={() => saveToLibrary(selected)} title="Salvar na Library">
                  <BookmarkPlus className="h-4 w-4 mr-1" /> Library
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(selected.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {selected.status === "error" && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                  Erro: {selected.error_message}
                </div>
              )}

              {selected.status === "done" && selected.analysis && selected.script && (
                <>
                  {/* Análise */}
                  <Section title="Por que viralizou">
                    <p className="text-sm text-muted-foreground italic">{selected.analysis.resumo}</p>
                    <ul className="mt-3 space-y-1.5">
                      {selected.analysis.porQueViralizou?.map((p: string, i: number) => (
                        <li key={i} className="text-sm flex gap-2">
                          <span className="text-primary">•</span><span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </Section>

                  <Section title="Estrutura original">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                      {selected.analysis.estrutura && Object.entries(selected.analysis.estrutura).map(([k, v]: any) => (
                        <div key={k} className="rounded-md border border-border p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                            {k} · {v.tempo}
                          </div>
                          <div className="text-sm">{v.texto}</div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  {/* Script novo */}
                  <Section
                    title="Seu roteiro adaptado"
                    action={
                      <Button size="sm" variant="ghost" onClick={() => copyText("Roteiro", selected.script.roteiroCompleto)}>
                        <Copy className="h-3 w-3 mr-1.5" /> Copiar tudo
                      </Button>
                    }
                  >
                    <div className="rounded-md border border-primary/30 bg-primary/5 p-4 mb-4">
                      <div className="text-[10px] uppercase tracking-wider text-primary mb-1">Hook</div>
                      <p className="text-base font-medium">{selected.script.hook}</p>
                    </div>

                    <div className="space-y-2">
                      {selected.script.scenes?.map((s: any) => (
                        <div key={s.n} className="rounded-md border border-border bg-card p-3 text-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-[10px]">#{s.n} · {s.tempo}</Badge>
                            <Badge variant="secondary" className="text-[10px] capitalize">{s.papel}</Badge>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Visual</div>
                              <div className="text-xs">{s.visual}</div>
                            </div>
                            <div>
                              <div className="text-[10px] text-muted-foreground uppercase">Fala / Copy</div>
                              <div className="text-xs">{s.copy}</div>
                            </div>
                            {s.broll && (
                              <div className="md:col-span-2">
                                <div className="text-[10px] text-muted-foreground uppercase">B-roll</div>
                                <div className="text-xs">{s.broll}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section
                    title="Caption sugerida"
                    action={
                      <Button size="sm" variant="ghost" onClick={() => copyText("Caption", selected.script.captionSugerida)}>
                        <Copy className="h-3 w-3 mr-1.5" /> Copiar
                      </Button>
                    }
                  >
                    <div className="rounded-md border border-border bg-card p-4 text-sm whitespace-pre-wrap">
                      {selected.script.captionSugerida}
                    </div>
                  </Section>

                  {selected.script.notasProducao?.length > 0 && (
                    <Section title="Notas de produção">
                      <ul className="space-y-1.5">
                        {selected.script.notasProducao.map((n: string, i: number) => (
                          <li key={i} className="text-sm flex gap-2">
                            <Eye className="h-3 w-3 mt-1 shrink-0 text-muted-foreground" />
                            <span>{n}</span>
                          </li>
                        ))}
                      </ul>
                    </Section>
                  )}
                </>
              )}

              {(selected.status === "pending" || selected.status === "processing") && (
                <div className="flex items-center justify-center p-12 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> Processando…
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

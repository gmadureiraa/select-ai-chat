/**
 * Radar Viral — briefing diário de inteligência por cliente.
 *
 * Modo "Briefing": Gemini agrega notícias + IG + TikTok + Threads + X + LinkedIn
 * em narrativas, hot topics, ideias de carrossel e cross-pollination.
 *
 * Modo "Feed ao vivo": mostra os posts brutos scrapeados nas últimas 48h,
 * filtráveis por plataforma. Útil pra ver sinais individuais antes do brief.
 *
 * Adaptado de github.com/gmadureiraa/radar-viral.
 * 2026-05-08 — adicionados Threads, X/Twitter e LinkedIn.
 */

import { useEffect, useState } from "react";
import {
  Loader2, Radar as RadarIcon, RefreshCw, Sparkles, Flame, Lightbulb,
  Layers, ExternalLink, AlertTriangle, History, Clock, Film, BookmarkPlus,
  Newspaper, Instagram, Music2, MessageCircle, Twitter, Linkedin, Globe,
  Heart, Repeat2, Eye, MessageSquare, ThumbsUp, BadgeCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { Client } from "@/hooks/useClients";
import { apiInvoke } from '../../lib/apiInvoke';

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

type Platform =
  | 'all'
  | 'news'
  | 'instagram'
  | 'tiktok'
  | 'threads'
  | 'twitter'
  | 'linkedin';

type ViewMode = 'briefing' | 'feed';

interface FeedItem {
  id: string;
  platform: Exclude<Platform, 'all'>;
  url: string;
  author: string | null;
  authorMeta?: string | null; // headline, name extra
  verified?: boolean;
  text: string | null;
  thumbnail?: string | null;
  posted_at: string | null;
  metrics: { primary: number; primaryLabel: string; secondary?: number; secondaryLabel?: string; tertiary?: number; tertiaryLabel?: string };
  isThread?: boolean;
  postType?: string | null;
}

interface ViralRadarTabProps {
  clientId: string;
  client: Client;
}

const PLATFORM_LABEL: Record<Exclude<Platform, 'all'>, string> = {
  news: 'Notícias',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  threads: 'Threads',
  twitter: 'X / Twitter',
  linkedin: 'LinkedIn',
};

const PLATFORM_ICON: Record<Exclude<Platform, 'all'>, any> = {
  news: Newspaper,
  instagram: Instagram,
  tiktok: Music2,
  threads: MessageCircle,
  twitter: Twitter,
  linkedin: Linkedin,
};

export function ViralRadarTab({ clientId, client }: ViralRadarTabProps) {
  const [generating, setGenerating] = useState(false);
  const [briefs, setBriefs] = useState<RadarBriefRow[]>([]);
  const [selected, setSelected] = useState<RadarBriefRow | null>(null);
  const [view, setView] = useState<ViewMode>('briefing');
  const [platform, setPlatform] = useState<Platform>('all');
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(false);
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

  // ─── Feed loader: busca posts brutos das 6 plataformas ────────────
  async function loadFeed() {
    setLoadingFeed(true);
    try {
      const cutoff = new Date(Date.now() - 48 * 3_600_000).toISOString();
      const niche = (client as any)?.industry ?? null;

      const tasks: Array<Promise<FeedItem[]>> = [];

      // news
      if (platform === 'all' || platform === 'news') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('viral_news_articles')
            .select('id,title,source_name,summary,url,published_at,thumbnail_url,niche')
            .gte('published_at', cutoff)
            .order('published_at', { ascending: false })
            .limit(15);
          return (data ?? []).map((n: any): FeedItem => ({
            id: n.id,
            platform: 'news',
            url: n.url,
            author: n.source_name,
            text: `${n.title}${n.summary ? ` — ${n.summary}` : ''}`,
            thumbnail: n.thumbnail_url,
            posted_at: n.published_at,
            metrics: { primary: 0, primaryLabel: '' },
          }));
        })());
      }

      // instagram (per-client)
      if (platform === 'all' || platform === 'instagram') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('instagram_posts')
            .select('id,caption,likes,comments,permalink,posted_at,thumbnail_url,metadata')
            .eq('client_id', clientId)
            .gte('posted_at', cutoff)
            .order('likes', { ascending: false })
            .limit(15);
          return (data ?? []).map((p: any): FeedItem => ({
            id: p.id,
            platform: 'instagram',
            url: p.permalink ?? '',
            author: p.metadata?.owner_username ?? null,
            text: p.caption,
            thumbnail: p.thumbnail_url,
            posted_at: p.posted_at,
            metrics: {
              primary: p.likes ?? 0, primaryLabel: 'curtidas',
              secondary: p.comments ?? 0, secondaryLabel: 'comentários',
            },
          }));
        })());
      }

      // tiktok
      if (platform === 'all' || platform === 'tiktok') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('viral_tiktok_posts')
            .select('id,author,caption,views,likes,comments,url,posted_at,thumbnail_url')
            .gte('posted_at', cutoff)
            .order('views', { ascending: false, nullsFirst: false })
            .limit(15);
          return (data ?? []).map((t: any): FeedItem => ({
            id: t.id,
            platform: 'tiktok',
            url: t.url,
            author: t.author,
            text: t.caption,
            thumbnail: t.thumbnail_url,
            posted_at: t.posted_at,
            metrics: {
              primary: t.views ?? 0, primaryLabel: 'views',
              secondary: t.likes ?? 0, secondaryLabel: 'curtidas',
              tertiary: t.comments ?? 0, tertiaryLabel: 'comentários',
            },
          }));
        })());
      }

      // threads
      if (platform === 'all' || platform === 'threads') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('viral_threads_posts')
            .select('id,author_handle,text_content,likes,reposts,replies,url,posted_at,media_urls')
            .gte('posted_at', cutoff)
            .order('likes', { ascending: false, nullsFirst: false })
            .limit(15);
          return (data ?? []).map((p: any): FeedItem => ({
            id: p.id,
            platform: 'threads',
            url: p.url,
            author: p.author_handle,
            text: p.text_content,
            thumbnail: p.media_urls?.[0] ?? null,
            posted_at: p.posted_at,
            metrics: {
              primary: p.likes ?? 0, primaryLabel: 'curtidas',
              secondary: p.reposts ?? 0, secondaryLabel: 'reposts',
              tertiary: p.replies ?? 0, tertiaryLabel: 'replies',
            },
          }));
        })());
      }

      // twitter
      if (platform === 'all' || platform === 'twitter') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('viral_twitter_posts')
            .select('id,author_handle,author_name,author_verified,text_content,is_thread,likes,retweets,views,replies,url,posted_at,media_urls')
            .gte('posted_at', cutoff)
            .order('likes', { ascending: false, nullsFirst: false })
            .limit(15);
          return (data ?? []).map((p: any): FeedItem => ({
            id: p.id,
            platform: 'twitter',
            url: p.url,
            author: p.author_handle,
            authorMeta: p.author_name,
            verified: p.author_verified,
            text: p.text_content,
            thumbnail: p.media_urls?.[0] ?? null,
            posted_at: p.posted_at,
            isThread: p.is_thread,
            metrics: {
              primary: p.likes ?? 0, primaryLabel: 'curtidas',
              secondary: p.retweets ?? 0, secondaryLabel: 'retweets',
              tertiary: p.views ?? 0, tertiaryLabel: 'views',
            },
          }));
        })());
      }

      // linkedin
      if (platform === 'all' || platform === 'linkedin') {
        tasks.push((async () => {
          const { data } = await supabase
            .from('viral_linkedin_posts')
            .select('id,author_name,author_headline,text_content,reactions,comments,shares,url,posted_at,post_type,media_urls')
            .gte('posted_at', cutoff)
            .order('reactions', { ascending: false, nullsFirst: false })
            .limit(15);
          return (data ?? []).map((p: any): FeedItem => ({
            id: p.id,
            platform: 'linkedin',
            url: p.url,
            author: p.author_name,
            authorMeta: p.author_headline,
            text: p.text_content,
            thumbnail: p.media_urls?.[0] ?? null,
            posted_at: p.posted_at,
            postType: p.post_type,
            metrics: {
              primary: p.reactions ?? 0, primaryLabel: 'reações',
              secondary: p.comments ?? 0, secondaryLabel: 'comentários',
              tertiary: p.shares ?? 0, tertiaryLabel: 'compartilhamentos',
            },
          }));
        })());
      }

      const results = (await Promise.all(tasks)).flat();
      // Sort: news by date, others by primary metric. When 'all', interleave by score.
      results.sort((a, b) => (b.metrics.primary ?? 0) - (a.metrics.primary ?? 0));
      // Suppress niche if client.industry exists (best-effort)
      void niche;
      setFeed(results);
    } catch (err: any) {
      console.error(err);
      toast.error('Falha ao carregar feed');
    } finally {
      setLoadingFeed(false);
    }
  }

  useEffect(() => { loadBriefs(); /* eslint-disable-next-line */ }, [clientId]);
  useEffect(() => {
    if (view === 'feed') loadFeed();
    /* eslint-disable-next-line */
  }, [view, platform, clientId]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data, error } = await apiInvoke("generate-radar-brief", {
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
      tab: "viral-carrossel",
      prompt: `Tema: ${idea.hook}\n\nÂngulo: ${idea.angle}`,
    });
    navigate(`/${(client as any)?.workspace_slug ?? ""}?${params.toString()}`);
  }

  function handleUseAsReel(topic: string, summary?: string) {
    const params = new URLSearchParams({
      client: clientId,
      tab: "viral-reels-page",
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
                onClick={() => { setSelected(b); setView('briefing'); }}
                className={cn(
                  "w-full text-left p-2.5 rounded-md text-xs hover:bg-accent/50 transition-colors",
                  selected?.id === b.id && view === 'briefing' && "bg-accent",
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
              <Badge variant="outline" className="text-xs">{client.name}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-border bg-card p-0.5">
                <button
                  onClick={() => setView('briefing')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                    view === 'briefing' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Briefing
                </button>
                <button
                  onClick={() => setView('feed')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded transition-colors",
                    view === 'feed' ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Feed ao vivo
                </button>
              </div>
              {view === 'briefing' && (
                <Button onClick={handleGenerate} disabled={generating} size="sm">
                  {generating
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Agregando…</>
                    : <><RefreshCw className="h-4 w-4 mr-2" /> Gerar briefing</>}
                </Button>
              )}
              {view === 'feed' && (
                <Button onClick={loadFeed} disabled={loadingFeed} size="sm" variant="outline">
                  {loadingFeed
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Carregando…</>
                    : <><RefreshCw className="h-4 w-4 mr-2" /> Atualizar</>}
                </Button>
              )}
            </div>
          </div>

          {/* ─── Platform filter chips (only in feed view) ───────────── */}
          {view === 'feed' && (
            <div className="flex flex-wrap gap-2">
              <PlatformChip active={platform === 'all'} onClick={() => setPlatform('all')} icon={Globe} label="Todas" />
              {(Object.keys(PLATFORM_LABEL) as Array<Exclude<Platform, 'all'>>).map((p) => {
                const Icon = PLATFORM_ICON[p];
                return (
                  <PlatformChip
                    key={p}
                    active={platform === p}
                    onClick={() => setPlatform(p)}
                    icon={Icon}
                    label={PLATFORM_LABEL[p]}
                  />
                );
              })}
            </div>
          )}

          {/* ─── BRIEFING VIEW ───────────────────────────────────────── */}
          {view === 'briefing' && (
            <>
              <p className="text-sm text-muted-foreground -mt-3">
                Agrega notícias, IG, TikTok, Threads, X e LinkedIn em narrativas, tópicos quentes e ideias prontas pra carrossel.
              </p>

              {!selected && !generating && (
                <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  <RadarIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="mb-1">Sem briefing ainda.</p>
                  <p className="text-xs">Clique em "Gerar briefing" pra agregar sinais das 6 plataformas.</p>
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
                    <span>📰 {selected.sources_summary?.news ?? selected.sources_summary?.news_count ?? 0}</span>
                    <span>📸 {selected.sources_summary?.ig ?? 0}</span>
                    <span>🎵 {selected.sources_summary?.tiktok ?? 0}</span>
                    <span>🧵 {selected.sources_summary?.threads ?? 0}</span>
                    <span>🐦 {selected.sources_summary?.twitter ?? 0}</span>
                    <span>💼 {selected.sources_summary?.linkedin ?? 0}</span>
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
                  <Section title="Temas em alta" icon={Flame}>
                    <div className="space-y-1.5">
                      {selected.hot_topics?.map((t: any, i: number) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-3 rounded-md border p-3 transition-colors",
                            i === 0
                              ? "border-primary/40 bg-primary/5"
                              : "border-border bg-card hover:bg-accent/30",
                          )}
                        >
                          <div className="shrink-0 w-10 h-10 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center text-xs font-bold tabular-nums">
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate flex items-center gap-2">
                              {t.topic}
                              <Badge variant="secondary" className="text-[10px] tabular-nums">
                                {t.signal_count} sinais
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{t.source_summary}</div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleUseAsCarousel({ hook: t.topic, angle: t.source_summary ?? "" })}
                              title="Virar carrossel"
                            >
                              <Layers className="h-3 w-3" /> Carrossel
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleUseAsReel(t.topic, t.source_summary)}
                              title="Adaptar como Reel"
                            >
                              <Film className="h-3 w-3" /> Reel
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1"
                              onClick={() => handleSaveAsIdea(t.topic, t.source_summary)}
                            >
                              <BookmarkPlus className="h-3 w-3" /> Salvar
                            </Button>
                          </div>
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
            </>
          )}

          {/* ─── FEED VIEW ──────────────────────────────────────────── */}
          {view === 'feed' && (
            <>
              {loadingFeed && (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin" />
                  Carregando feed das últimas 48h…
                </div>
              )}

              {!loadingFeed && feed.length === 0 && (
                <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                  <RadarIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p className="mb-1">Sem sinais nas últimas 48h.</p>
                  <p className="text-xs">Os crons rodam diariamente. Pode estar gated por env flag (RADAR_*_CRON_ENABLED).</p>
                </div>
              )}

              {!loadingFeed && feed.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {feed.length} sinais · ordenados por engajamento · janela: 48h
                  </div>
                  {feed.map((item) => (
                    <FeedCard
                      key={`${item.platform}-${item.id}`}
                      item={item}
                      onUseAsCarousel={() => handleUseAsCarousel({
                        hook: item.text?.slice(0, 100) ?? '(sem texto)',
                        angle: `Fonte: ${item.author ?? '?'} (${PLATFORM_LABEL[item.platform]})`,
                      })}
                      onUseAsReel={() => handleUseAsReel(
                        item.text?.slice(0, 120) ?? '(sem texto)',
                        `Fonte: ${item.author ?? '?'} (${PLATFORM_LABEL[item.platform]})`,
                      )}
                      onSaveIdea={() => handleSaveAsIdea(
                        item.text?.slice(0, 120) ?? '(sem título)',
                        `${PLATFORM_LABEL[item.platform]} · ${item.author ?? '?'}`,
                      )}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PlatformChip({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-accent/30",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function MetricPill({ icon: Icon, value, label }: { icon: any; value: number; label: string }) {
  if (!value) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tabular-nums">
      <Icon className="h-3 w-3" /> {formatNumber(value)} <span className="opacity-70">{label}</span>
    </span>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function FeedCard({
  item, onUseAsCarousel, onUseAsReel, onSaveIdea,
}: {
  item: FeedItem;
  onUseAsCarousel: () => void;
  onUseAsReel: () => void;
  onSaveIdea: () => void;
}) {
  const Icon = PLATFORM_ICON[item.platform];
  const platformBadge = PLATFORM_LABEL[item.platform];

  // Pick metric icons by platform style
  const primaryIcon = item.platform === 'tiktok' ? Eye : item.platform === 'linkedin' ? ThumbsUp : Heart;
  const secondaryIcon = item.platform === 'twitter' ? Repeat2 : MessageSquare;
  const tertiaryIcon = item.platform === 'twitter' ? Eye : MessageSquare;

  return (
    <div className="rounded-lg border border-border bg-card hover:bg-accent/10 transition-colors p-3 flex gap-3">
      {item.thumbnail && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-20 h-20 rounded-md overflow-hidden bg-muted"
        >
          <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
        </a>
      )}
      {!item.thumbnail && (
        <div className="shrink-0 w-20 h-20 rounded-md bg-muted/40 flex items-center justify-center text-muted-foreground">
          <Icon className="h-6 w-6 opacity-50" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Icon className="h-2.5 w-2.5" /> {platformBadge}
          </Badge>
          {item.author && (
            <span className="text-xs font-medium truncate flex items-center gap-1">
              {item.platform === 'twitter' || item.platform === 'instagram' || item.platform === 'tiktok' || item.platform === 'threads' ? '@' : ''}
              {item.author}
              {item.verified && <BadgeCheck className="h-3 w-3 text-blue-500 shrink-0" />}
            </span>
          )}
          {item.isThread && <Badge variant="secondary" className="text-[10px]">thread</Badge>}
          {item.postType && item.platform === 'linkedin' && <Badge variant="secondary" className="text-[10px]">{item.postType}</Badge>}
          {item.posted_at && (
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {new Date(item.posted_at).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        {item.authorMeta && (
          <div className="text-[11px] text-muted-foreground truncate mb-1">{item.authorMeta}</div>
        )}
        <p className="text-sm text-foreground/90 line-clamp-2 mb-2">{item.text ?? '(sem texto)'}</p>

        <div className="flex items-center gap-3 mb-2">
          {item.metrics.primary > 0 && (
            <MetricPill icon={primaryIcon} value={item.metrics.primary} label={item.metrics.primaryLabel} />
          )}
          {item.metrics.secondary != null && item.metrics.secondary > 0 && (
            <MetricPill icon={secondaryIcon} value={item.metrics.secondary} label={item.metrics.secondaryLabel ?? ''} />
          )}
          {item.metrics.tertiary != null && item.metrics.tertiary > 0 && (
            <MetricPill icon={tertiaryIcon} value={item.metrics.tertiary} label={item.metrics.tertiaryLabel ?? ''} />
          )}
        </div>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={onUseAsCarousel}>
            <Layers className="h-3 w-3" /> Carrossel
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={onUseAsReel}>
            <Film className="h-3 w-3" /> Reel
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={onSaveIdea}>
            <BookmarkPlus className="h-3 w-3" /> Salvar
          </Button>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground px-2 py-1"
            >
              <ExternalLink className="h-3 w-3" /> Abrir
            </a>
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

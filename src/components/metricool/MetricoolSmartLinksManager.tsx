// MetricoolSmartLinksManager — encurtador URL com tracking + analytics.
// - Lista smart links (id, slug, short URL, clicks, created)
// - Cria novo (URL alvo + slug/nome opcional + UTMs)
// - Stats de clicks por link (sparkline simples)
// - Search por URL/slug/nome
// - Delete
import { useMemo, useState } from 'react';
import {
  useMetricoolSmartLinks,
  useMetricoolSmartLinkTimeline,
  useCreateMetricoolSmartLink,
  useDeleteMetricoolSmartLink,
  type MetricoolSmartLink,
} from '@/hooks/useMetricoolSmartLinks';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Loader2,
  Link2,
  Plus,
  Copy,
  Search,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  MousePointerClick,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface Props {
  clientId: string;
}

const METRICOOL_SHORT_DOMAIN = 'https://mtr.cool';

function buildShortUrl(link: MetricoolSmartLink): string {
  if (link.shortUrl && typeof link.shortUrl === 'string') return link.shortUrl;
  if (link.slug) return `${METRICOOL_SHORT_DOMAIN}/${link.slug}`;
  return '';
}

function buildOriginalUrl(link: MetricoolSmartLink): string {
  if (link.originalUrl && typeof link.originalUrl === 'string') return link.originalUrl;
  // Tenta extrair do content.buttons primeiro
  const btns = (link.content?.buttons || []) as any[];
  const first = btns.find((b) => b?.link || b?.url);
  if (first) return first.link || first.url || '';
  return '';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return value;
  }
}

function sumTimeline(timeline: Array<{ value?: number }>): number {
  return timeline.reduce((acc, p) => acc + (Number(p.value) || 0), 0);
}

interface TimelineSparkProps {
  clientId: string;
  id: number | string;
}

function TimelineSpark({ clientId, id }: TimelineSparkProps) {
  const { data: timeline = [], isLoading } = useMetricoolSmartLinkTimeline(clientId, id);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando timeline...
      </div>
    );
  }

  if (!timeline.length) {
    return (
      <div className="text-xs text-muted-foreground p-3">
        Sem dados de cliques nos últimos 30 dias.
      </div>
    );
  }

  const values = timeline.map((p) => Number(p.value) || 0);
  const max = values.reduce((acc, v) => (v > acc ? v : acc), 0) || 1;
  const total = sumTimeline(timeline);

  return (
    <div className="p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground flex items-center gap-1">
          <TrendingUp className="h-3 w-3" /> Clicks últimos 30d
        </span>
        <span className="font-semibold tabular-nums">
          {total.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="flex items-end gap-0.5 h-12">
        {timeline.slice(-30).map((p, i) => {
          const v = Number(p.value) || 0;
          const h = Math.max(2, Math.round((v / max) * 100));
          return (
            <div
              key={i}
              className="flex-1 bg-emerald-500/70 rounded-sm"
              style={{ height: `${h}%` }}
              title={`${p.date || ''}: ${v}`}
            />
          );
        })}
      </div>
    </div>
  );
}

export function MetricoolSmartLinksManager({ clientId }: Props) {
  const { toast } = useToast();
  const { data: links = [], isLoading, error } = useMetricoolSmartLinks(clientId);
  const createMutation = useCreateMetricoolSmartLink(clientId);
  const deleteMutation = useDeleteMetricoolSmartLink(clientId);

  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form state
  const [originalUrl, setOriginalUrl] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');

  const filteredLinks = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter((l) => {
      const orig = buildOriginalUrl(l).toLowerCase();
      const short = buildShortUrl(l).toLowerCase();
      const slugV = (l.slug || '').toLowerCase();
      const nameV = (l.name || '').toLowerCase();
      return orig.includes(q) || short.includes(q) || slugV.includes(q) || nameV.includes(q);
    });
  }, [links, search]);

  const buildTargetUrl = (): string => {
    const base = originalUrl.trim();
    if (!base) return '';
    const params: string[] = [];
    if (utmSource.trim()) params.push(`utm_source=${encodeURIComponent(utmSource.trim())}`);
    if (utmMedium.trim()) params.push(`utm_medium=${encodeURIComponent(utmMedium.trim())}`);
    if (utmCampaign.trim()) params.push(`utm_campaign=${encodeURIComponent(utmCampaign.trim())}`);
    if (!params.length) return base;
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}${params.join('&')}`;
  };

  const handleCreate = async () => {
    const target = buildTargetUrl();
    if (!target) {
      toast({
        title: 'URL obrigatória',
        description: 'Cole o link original que quer encurtar.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const link = await createMutation.mutateAsync({
        name: name.trim() || undefined,
        slug: slug.trim() || undefined,
        content: {
          buttons: [{ link: target, text: name.trim() || target }],
        },
      });
      const short = buildShortUrl(link);
      if (short) {
        try {
          await navigator.clipboard.writeText(short);
        } catch {}
        toast({
          title: 'Smart link criado',
          description: `${short} (copiado)`,
        });
      } else {
        toast({
          title: 'Smart link criado',
          description: 'Link gerado com sucesso.',
        });
      }
      setOriginalUrl('');
      setName('');
      setSlug('');
      setUtmSource('');
      setUtmMedium('');
      setUtmCampaign('');
    } catch (e: any) {
      toast({
        title: 'Erro ao criar smart link',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleCopy = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: text });
    } catch (e: any) {
      toast({ title: 'Falha ao copiar', description: e?.message || String(e), variant: 'destructive' });
    }
  };

  const handleDelete = async (id?: number) => {
    if (id == null) return;
    if (!confirm('Deletar smart link? Os links já distribuídos vão parar de funcionar.')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Smart link deletado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao deletar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" /> Smart Links (Metricool)
        </CardTitle>
        <CardDescription>
          Encurtador URL com tracking de cliques, UTMs e analytics por canal.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">Meus links</TabsTrigger>
            <TabsTrigger value="create">
              <Plus className="h-3 w-3 mr-1" /> Novo
            </TabsTrigger>
          </TabsList>

          {/* LIST */}
          <TabsContent value="list" className="space-y-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por URL, slug ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando smart links...
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive border border-destructive/40 rounded-md p-3">
                Erro ao carregar links: {(error as Error)?.message}
              </div>
            )}

            {!isLoading && filteredLinks.length === 0 && (
              <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                {search
                  ? 'Nenhum link bate com a busca.'
                  : 'Nenhum smart link ainda. Crie o primeiro pra começar a rastrear cliques.'}
              </div>
            )}

            {!isLoading && filteredLinks.length > 0 && (
              <div className="space-y-2">
                {filteredLinks.map((link) => {
                  const id = String(link.id ?? link.slug ?? Math.random());
                  const isOpen = expandedId === id;
                  const short = buildShortUrl(link);
                  const orig = buildOriginalUrl(link);
                  const clicks = Number(link.clicks ?? 0);
                  return (
                    <div key={id} className="rounded-md border overflow-hidden">
                      <div className="flex items-start gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => link.id != null && toggleExpand(id)}
                          className="mt-0.5 text-muted-foreground hover:text-foreground"
                          aria-label={isOpen ? 'Recolher' : 'Expandir'}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate">
                              {link.name || link.slug || `#${link.id}`}
                            </span>
                            {link.slug && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                /{link.slug}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-[10px] gap-1">
                              <MousePointerClick className="h-3 w-3" />
                              {clicks.toLocaleString('pt-BR')}
                            </Badge>
                          </div>
                          {short && (
                            <button
                              type="button"
                              onClick={() => handleCopy(short)}
                              className="text-xs font-mono text-emerald-600 hover:underline truncate block max-w-full text-left"
                              title="Copiar"
                            >
                              {short}
                            </button>
                          )}
                          {orig && (
                            <a
                              href={orig}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-muted-foreground hover:underline truncate block max-w-full"
                              title={orig}
                            >
                              <ExternalLink className="h-3 w-3 inline-block mr-1" />
                              {orig}
                            </a>
                          )}
                          <div className="text-[10px] text-muted-foreground">
                            Criado em {formatDate(link.createDate?.dateTime)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {short && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => handleCopy(short)}
                              title="Copiar URL curta"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(link.id)}
                            disabled={deleteMutation.isPending}
                            title="Deletar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {isOpen && link.id != null && (
                        <div className="border-t bg-muted/10">
                          <TimelineSpark clientId={clientId} id={link.id} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* CREATE */}
          <TabsContent value="create" className="space-y-4">
            <div className="rounded-md border p-4 space-y-4 bg-muted/20">
              <div className="space-y-2">
                <Label htmlFor="sl-url">URL original *</Label>
                <Input
                  id="sl-url"
                  placeholder="https://exemplo.com.br/landing"
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sl-name">Nome (interno)</Label>
                  <Input
                    id="sl-name"
                    placeholder="Campanha Black Friday"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sl-slug">Slug (URL curta)</Label>
                  <Input
                    id="sl-slug"
                    placeholder="bf2026"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/gi, ''))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  UTMs (opcional)
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Input
                    placeholder="utm_source"
                    value={utmSource}
                    onChange={(e) => setUtmSource(e.target.value)}
                  />
                  <Input
                    placeholder="utm_medium"
                    value={utmMedium}
                    onChange={(e) => setUtmMedium(e.target.value)}
                  />
                  <Input
                    placeholder="utm_campaign"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                  />
                </div>
              </div>
              {originalUrl.trim() && (
                <div className="text-xs text-muted-foreground border-l-2 border-emerald-500 pl-2 break-all">
                  <span className="text-foreground/60">URL final: </span>
                  {buildTargetUrl()}
                </div>
              )}
              <Button
                onClick={handleCreate}
                disabled={createMutation.isPending}
                className="w-full sm:w-auto"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Criando...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" /> Criar smart link
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

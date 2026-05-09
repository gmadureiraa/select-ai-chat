// MetricoolHashtagsTracker — tracking de hashtags (lista, criação, distribuição).
import { useMemo, useState } from 'react';
import {
  useMetricoolHashtagSessions,
  useMetricoolHashtagDistribution,
  useCreateMetricoolHashtag,
  type MetricoolHashtagSession,
} from '@/hooks/useMetricoolHashtags';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Hash,
  Plus,
  ChevronDown,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';

interface Props {
  clientId: string;
}

const NETWORKS: Array<{ value: string; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
];

function formatDate(value?: string): string {
  if (!value) return '—';
  try {
    return format(new Date(value), 'dd/MM/yyyy');
  } catch {
    return value;
  }
}

interface DistributionRowsProps {
  clientId: string;
  sessionId: string | number;
}

function DistributionRows({ clientId, sessionId }: DistributionRowsProps) {
  const { data, isLoading } = useMetricoolHashtagDistribution(clientId, sessionId);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ label: string; value: number }>;

    // Heurística: o handler retorna um objeto opaco — tentar extrair shape comum.
    const distribution: any = data;
    if (Array.isArray(distribution)) {
      return distribution
        .map((item: any) => ({
          label: String(item.label ?? item.hashtag ?? item.name ?? item.key ?? '—'),
          value: Number(item.value ?? item.count ?? item.impressions ?? item.posts ?? 0),
        }))
        .filter((r) => r.label && Number.isFinite(r.value));
    }
    if (Array.isArray(distribution?.data)) {
      return distribution.data
        .map((item: any) => ({
          label: String(item.label ?? item.hashtag ?? item.name ?? item.key ?? '—'),
          value: Number(item.value ?? item.count ?? item.impressions ?? item.posts ?? 0),
        }))
        .filter((r: { label: string; value: number }) => r.label && Number.isFinite(r.value));
    }
    if (distribution && typeof distribution === 'object') {
      // fallback: tratar como Record<string, number>
      return Object.entries(distribution)
        .filter(([, v]) => typeof v === 'number')
        .map(([k, v]) => ({ label: k, value: Number(v) }));
    }
    return [];
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando distribuição...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-xs text-muted-foreground p-3">
        Sem dados de distribuição ainda. Metricool precisa coletar amostras antes.
      </div>
    );
  }

  const max = rows.reduce((acc, r) => (r.value > acc ? r.value : acc), 0) || 1;

  return (
    <div className="space-y-1.5 p-3">
      {rows.slice(0, 12).map((r, i) => {
        const pct = Math.max(2, Math.round((r.value / max) * 100));
        return (
          <div key={`${r.label}-${i}`} className="flex items-center gap-2 text-xs">
            <div className="w-32 truncate text-muted-foreground" title={r.label}>
              {r.label}
            </div>
            <div className="flex-1 h-3 rounded bg-muted/40 overflow-hidden">
              <div
                className="h-full bg-emerald-500/70"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="w-12 text-right tabular-nums">
              {r.value.toLocaleString('pt-BR')}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MetricoolHashtagsTracker({ clientId }: Props) {
  const { toast } = useToast();
  const { data: sessions = [], isLoading } = useMetricoolHashtagSessions(clientId);
  const createMutation = useCreateMetricoolHashtag(clientId);

  const [hashtag, setHashtag] = useState('');
  const [network, setNetwork] = useState<string>('instagram');
  const [duration, setDuration] = useState<number>(7);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleCreate = async () => {
    const tag = hashtag.trim().replace(/^#/, '');
    if (!tag) {
      toast({
        title: 'Hashtag obrigatória',
        description: 'Digite uma hashtag pra rastrear.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await createMutation.mutateAsync({
        hashtag: tag,
        network,
        durationDays: duration,
      });
      toast({
        title: 'Hashtag rastreada',
        description: `#${tag} (${network}) por ${duration} dias.`,
      });
      setHashtag('');
    } catch (e: any) {
      toast({
        title: 'Erro ao criar sessão',
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
          <Hash className="h-5 w-5" /> Hashtags rastreadas (Metricool)
        </CardTitle>
        <CardDescription>
          Acompanhe impressões, alcance e crescimento de hashtags por plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form de criação */}
        <div className="rounded-md border p-3 space-y-3 bg-muted/20">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Plus className="h-3 w-3" /> Nova hashtag
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="#exemplo"
              value={hashtag}
              onChange={(e) => setHashtag(e.target.value)}
              className="flex-1"
            />
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger className="sm:w-40">
                <SelectValue placeholder="Rede" />
              </SelectTrigger>
              <SelectContent>
                {NETWORKS.map((n) => (
                  <SelectItem key={n.value} value={n.value}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Duração</span>
              <span className="tabular-nums">{duration} dia{duration === 1 ? '' : 's'}</span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={[duration]}
              onValueChange={(v) => setDuration(v[0] ?? 7)}
            />
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={createMutation.isPending}
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> Criando...
              </>
            ) : (
              <>
                <Plus className="h-3 w-3 mr-1" /> Rastrear hashtag
              </>
            )}
          </Button>
        </div>

        {/* Lista */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando sessões...
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
            Nenhuma hashtag rastreada. Crie a primeira pra ver impressões e crescimento.
          </div>
        )}

        {!isLoading && sessions.length > 0 && (
          <div className="space-y-2">
            {sessions.map((s: MetricoolHashtagSession) => {
              const id = String(s.id);
              const isOpen = expandedId === id;
              return (
                <div key={id} className="rounded-md border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(id)}
                    className="w-full flex items-center justify-between gap-3 p-3 hover:bg-muted/30 transition text-left"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium truncate">
                        #{s.hashtag.replace(/^#/, '')}
                      </span>
                      <Badge variant="outline" className="text-xs capitalize">
                        {s.network}
                      </Badge>
                      {s.active ? (
                        <Badge variant="default" className="text-xs gap-1">
                          <TrendingUp className="h-3 w-3" /> Ativa
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Encerrada
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatDate(s.startDate)} → {formatDate(s.endDate)}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t bg-muted/10">
                      <DistributionRows clientId={clientId} sessionId={s.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

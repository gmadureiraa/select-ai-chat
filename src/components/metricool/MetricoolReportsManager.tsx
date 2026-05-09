// MetricoolReportsManager — gera, lista e baixa relatórios Metricool
// (Performance Dashboards + histórico de PDFs gerados pela Metricool).
import { useMemo, useState } from 'react';
import {
  useMetricoolReports,
  useGenerateMetricoolDashboard,
  useDeleteMetricoolDashboard,
  useSyncMetricoolDashboard,
  type MetricoolPerformanceDashboard,
  type MetricoolReportHistoryItem,
} from '@/hooks/useMetricoolReports';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  FileText,
  Download,
  Plus,
  Trash2,
  RefreshCw,
  Calendar as CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  clientId: string;
}

const PLATFORMS: Array<{ value: string; label: string }> = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'X / Twitter' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'threads', label: 'Threads' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'bluesky', label: 'Bluesky' },
];

const PERIOD_PRESETS: Array<{ key: string; label: string; days: number }> = [
  { key: '7d', label: 'Últimos 7 dias', days: 7 },
  { key: '14d', label: 'Últimos 14 dias', days: 14 },
  { key: '30d', label: 'Últimos 30 dias', days: 30 },
  { key: '90d', label: 'Últimos 90 dias', days: 90 },
];

function formatDateBR(value?: string): string {
  if (!value) return '—';
  try {
    return format(new Date(value), "dd 'de' MMM yyyy", { locale: ptBR });
  } catch {
    return value;
  }
}

function isoNoTz(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const s = status.toUpperCase();
  if (s === 'FINISHED') {
    return (
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
        <CheckCircle2 className="h-3 w-3" /> Pronto
      </Badge>
    );
  }
  if (s === 'PENDING' || s === 'RUNNING' || s === 'RETRYING') {
    return (
      <Badge variant="secondary" className="gap-1">
        <Clock className="h-3 w-3 animate-pulse" /> Gerando...
      </Badge>
    );
  }
  if (s === 'FAILED') {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" /> Falhou
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

function platformsFromHistory(item: MetricoolReportHistoryItem): string[] {
  const flags: Array<keyof MetricoolReportHistoryItem> = [
    'instagram',
    'facebook',
    'twitter',
    'linkedin',
    'tiktok',
    'threads',
    'bluesky',
    'pinterest',
    'youtube',
  ];
  return flags.filter((k) => item[k]).map((k) => String(k));
}

function dashboardDateRange(d: MetricoolPerformanceDashboard): string {
  const from =
    typeof d.from === 'string' ? d.from : (d.from as any)?.dateTime ?? '';
  const to = typeof d.to === 'string' ? d.to : (d.to as any)?.dateTime ?? '';
  return `${formatDateBR(from)} → ${formatDateBR(to)}`;
}

export function MetricoolReportsManager({ clientId }: Props) {
  const { toast } = useToast();
  const { data, isLoading, refetch, isFetching } = useMetricoolReports(clientId);
  const generateMutation = useGenerateMetricoolDashboard(clientId);
  const deleteMutation = useDeleteMetricoolDashboard(clientId);
  const syncMutation = useSyncMetricoolDashboard(clientId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [periodKey, setPeriodKey] = useState<string>('30d');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([
    'instagram',
    'facebook',
  ]);

  const dashboards = data?.dashboards ?? [];
  const history = data?.history ?? [];

  const inProgressCount = useMemo(
    () =>
      history.filter(
        (r) => r.status === 'PENDING' || r.status === 'RUNNING' || r.status === 'RETRYING',
      ).length,
    [history],
  );

  const togglePlatform = (p: string) => {
    setSelectedPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPeriodKey('30d');
    setSelectedPlatforms(['instagram', 'facebook']);
  };

  const handleGenerate = async () => {
    if (!title.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Dê um nome ao relatório.',
        variant: 'destructive',
      });
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast({
        title: 'Selecione plataformas',
        description: 'Marque ao menos uma rede social.',
        variant: 'destructive',
      });
      return;
    }
    const preset = PERIOD_PRESETS.find((p) => p.key === periodKey) || PERIOD_PRESETS[2];
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 24 * 60 * 60 * 1000);

    try {
      await generateMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || `Relatório ${preset.label.toLowerCase()}`,
        from: isoNoTz(from),
        to: isoNoTz(to),
        networks: selectedPlatforms,
      });
      toast({
        title: 'Relatório criado',
        description: 'Dashboard sendo processado pela Metricool.',
      });
      setDialogOpen(false);
      resetForm();
    } catch (e: any) {
      toast({
        title: 'Erro ao gerar relatório',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (dashboardId: string | number) => {
    if (!confirm('Apagar esse relatório? Não dá pra desfazer.')) return;
    try {
      await deleteMutation.mutateAsync(dashboardId);
      toast({ title: 'Relatório apagado' });
    } catch (e: any) {
      toast({
        title: 'Erro ao apagar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleSync = async (dashboardId: string | number) => {
    try {
      await syncMutation.mutateAsync(dashboardId);
      toast({
        title: 'Sync iniciado',
        description: 'Métricas serão atualizadas em segundo plano.',
      });
    } catch (e: any) {
      toast({
        title: 'Erro ao sincronizar',
        description: e?.message || String(e),
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (item: MetricoolReportHistoryItem) => {
    if (!item.reportFile) {
      toast({
        title: 'Arquivo indisponível',
        description: 'Esse relatório ainda não tem PDF pronto.',
        variant: 'destructive',
      });
      return;
    }
    window.open(item.reportFile, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" /> Relatórios
              </CardTitle>
              <CardDescription>
                Performance Dashboards e relatórios PDF gerados pela Metricool.
                {inProgressCount > 0 && (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    {inProgressCount} em geração...
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span className="ml-1.5">Atualizar</span>
              </Button>
              <Dialog
                open={dialogOpen}
                onOpenChange={(o) => {
                  setDialogOpen(o);
                  if (!o) resetForm();
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Novo relatório
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Gerar novo relatório</DialogTitle>
                    <DialogDescription>
                      Cria um Performance Dashboard na Metricool com as plataformas
                      e período selecionados.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="report-title">Título</Label>
                      <Input
                        id="report-title"
                        placeholder="ex: Performance maio/2026"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="report-desc">Descrição</Label>
                      <Textarea
                        id="report-desc"
                        placeholder="Contexto do relatório (opcional)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Período</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {PERIOD_PRESETS.map((p) => (
                          <Button
                            key={p.key}
                            type="button"
                            size="sm"
                            variant={periodKey === p.key ? 'default' : 'outline'}
                            onClick={() => setPeriodKey(p.key)}
                          >
                            {p.label.replace('Últimos ', '')}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Plataformas</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PLATFORMS.map((p) => (
                          <label
                            key={p.value}
                            className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm cursor-pointer hover:bg-muted/40"
                          >
                            <Checkbox
                              checked={selectedPlatforms.includes(p.value)}
                              onCheckedChange={() => togglePlatform(p.value)}
                            />
                            <span className="truncate">{p.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                      disabled={generateMutation.isPending}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                      {generateMutation.isPending ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Gerando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-3.5 w-3.5 mr-1.5" /> Gerar
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="dashboards">
            <TabsList>
              <TabsTrigger value="dashboards">
                Dashboards <Badge variant="secondary" className="ml-2">{dashboards.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="history">
                Histórico PDF <Badge variant="secondary" className="ml-2">{history.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dashboards" className="mt-4 space-y-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando dashboards...
                </div>
              )}
              {!isLoading && dashboards.length === 0 && (
                <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                  Nenhum dashboard ainda. Clique em "Novo relatório" pra começar.
                </div>
              )}
              {!isLoading &&
                dashboards.map((d) => {
                  const id = String(d.id);
                  return (
                    <div
                      key={id}
                      className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-muted/30 transition"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-medium truncate">{d.title || 'Sem título'}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {d.description || '—'}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <Badge variant="outline" className="text-xs gap-1">
                            <CalendarIcon className="h-3 w-3" />
                            {dashboardDateRange(d)}
                          </Badge>
                          {(d.networks || []).map((n) => (
                            <Badge key={n} variant="secondary" className="text-xs capitalize">
                              {n}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSync(d.id)}
                          disabled={syncMutation.isPending}
                          title="Sincronizar métricas"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(d.id)}
                          disabled={deleteMutation.isPending}
                          title="Apagar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </TabsContent>

            <TabsContent value="history" className="mt-4 space-y-2">
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
                </div>
              )}
              {!isLoading && history.length === 0 && (
                <div className="text-sm text-muted-foreground text-center p-8 border border-dashed rounded-md">
                  Nenhum relatório PDF gerado ainda.
                </div>
              )}
              {!isLoading &&
                history.map((item, idx) => {
                  const platforms = platformsFromHistory(item);
                  return (
                    <div
                      key={`${item.jobId || item.creationDate || idx}`}
                      className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {item.reportType || 'Relatório'} · {formatDateBR(item.creationDate)}
                          </span>
                          <StatusBadge status={item.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Período: {formatDateBR(item.from)} → {formatDateBR(item.to)}
                        </div>
                        {platforms.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {platforms.map((p) => (
                              <Badge key={p} variant="outline" className="text-xs capitalize">
                                {p}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!item.reportFile || item.status !== 'FINISHED'}
                          onClick={() => handleDownload(item)}
                        >
                          <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

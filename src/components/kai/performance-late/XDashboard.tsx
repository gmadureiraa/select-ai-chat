// XDashboard — dashboard especial pro X/Twitter sem fetch automático.
//
// X API custa USD 100-5000/mês. Em vez de pagar, o usuário cola relatórios
// manuais via XManualReportModal. Aqui mostramos:
//   - Aviso explicando porque não tem fetch automático
//   - Lista de relatórios passados (com KPIs principais)
//   - Botão "Adicionar relatório manual" que abre o modal
import { useState, useMemo } from 'react';
import {
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  Bookmark,
  UserPlus,
  Plug,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useXManualReports,
  useDeleteXManualReport,
  type XManualReport,
} from '@/hooks/useXManualReports';
import { XManualReportModal } from './XManualReportModal';
import { KPICard } from './KPICard';
import { formatNumber, formatDateShort } from './_format';

interface Props {
  clientId: string;
}

export function XDashboard({ clientId }: Props) {
  const { data: reports = [], isLoading, error } = useXManualReports(clientId);
  const deleteReport = useDeleteXManualReport(clientId);
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Soma de todos os relatórios (últimos 90d cap).
  const totals = useMemo(() => {
    const cutoff = Date.now() - 90 * 86400000;
    const recent = reports.filter((r) => {
      const t = new Date(r.period_end).getTime();
      return Number.isFinite(t) && t >= cutoff;
    });
    return recent.reduce(
      (acc, r) => ({
        impressions: acc.impressions + (r.impressions || 0),
        engagements: acc.engagements + (r.engagements || 0),
        likes: acc.likes + (r.likes || 0),
        replies: acc.replies + (r.replies || 0),
        retweets: acc.retweets + (r.retweets || 0),
        newFollowers: acc.newFollowers + (r.new_followers || 0),
      }),
      { impressions: 0, engagements: 0, likes: 0, replies: 0, retweets: 0, newFollowers: 0 },
    );
  }, [reports]);

  const confirmDelete = () => {
    if (pendingDeleteId) {
      deleteReport.mutate(pendingDeleteId, {
        onSettled: () => setPendingDeleteId(null),
      });
    }
  };

  // Error fatal — handler ou rede falhou
  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <EmptyState
            icon={Plug}
            title="Erro ao carregar relatórios do X"
            description={error.message || 'Não conseguimos buscar os relatórios manuais. Tente atualizar a página.'}
            action={
              <Button onClick={() => setModalOpen(true)} variant="outline" className="gap-1.5">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Adicionar relatório manual
              </Button>
            }
          />
          <XManualReportModal open={modalOpen} onOpenChange={setModalOpen} clientId={clientId} />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso permanente sobre por que é manual */}
      <Alert>
        <AlertCircle aria-hidden="true" className="h-4 w-4" />
        <AlertTitle>Métricas do X são manuais</AlertTitle>
        <AlertDescription className="text-sm">
          As métricas do X/Twitter devem ser puxadas manualmente do{' '}
          <a
            href="https://twitter.com/i/analytics"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground inline-flex items-center gap-1"
          >
            twitter.com/analytics
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
          . O custo da X API (USD 100-5000/mês) tornaria a automação cara, então
          a gente registra relatórios manuais por período aqui.
        </AlertDescription>
      </Alert>

      {/* KPI mini-row — totais últimos 90d */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Impressões (90d)" value={formatNumber(totals.impressions)} icon={Eye} />
          <KPICard label="Engajamentos" value={formatNumber(totals.engagements)} icon={MessageCircle} />
          <KPICard label="Curtidas" value={formatNumber(totals.likes)} icon={Heart} />
          <KPICard label="Respostas" value={formatNumber(totals.replies)} icon={MessageCircle} />
          <KPICard label="Retweets" value={formatNumber(totals.retweets)} icon={Repeat2} />
          <KPICard label="Novos seguidores" value={formatNumber(totals.newFollowers)} icon={UserPlus} />
        </div>
      )}

      {/* Header da lista + botão */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-base font-semibold">Relatórios registrados</h3>
          <p className="text-xs text-muted-foreground">
            {reports.length} relatório{reports.length === 1 ? '' : 's'} no histórico.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-1.5">
          <Plus aria-hidden="true" className="h-4 w-4" />
          Adicionar relatório manual
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
          <span className="sr-only">Carregando relatórios…</span>
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-10">
            <EmptyState
              icon={Bookmark}
              title="Nenhum relatório ainda"
              description="Cole os números de twitter.com/analytics pra começar a acompanhar a performance do X aqui no KAI."
              action={
                <Button onClick={() => setModalOpen(true)} className="gap-1.5">
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Adicionar primeiro relatório
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onDelete={() => setPendingDeleteId(r.id)}
              isDeleting={deleteReport.isPending && pendingDeleteId === r.id}
            />
          ))}
        </div>
      )}

      <XManualReportModal open={modalOpen} onOpenChange={setModalOpen} clientId={clientId} />

      {/* Confirm dialog acessível (substitui confirm() bloqueante) */}
      <AlertDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              Os números do período serão apagados do histórico. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteReport.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteReport.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReport.isPending ? 'Removendo…' : 'Remover'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReportRow({
  report,
  onDelete,
  isDeleting,
}: {
  report: XManualReport;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-sm font-semibold">
            {formatDateShort(report.period_start)} — {formatDateShort(report.period_end)}
          </CardTitle>
          {report.notes && (
            <CardDescription className="mt-1 text-xs">{report.notes}</CardDescription>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          disabled={isDeleting}
          aria-label={`Remover relatório de ${report.period_start} a ${report.period_end}`}
        >
          <Trash2 aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
          <MetricChip icon={Eye} label="Imp." value={report.impressions} />
          <MetricChip icon={MessageCircle} label="Eng." value={report.engagements} />
          <MetricChip icon={Heart} label="Likes" value={report.likes} />
          <MetricChip icon={MessageCircle} label="Replies" value={report.replies} />
          <MetricChip icon={Repeat2} label="RT" value={report.retweets} />
          <MetricChip icon={Bookmark} label="Bookmarks" value={report.bookmarks} />
          <MetricChip icon={UserPlus} label="+Followers" value={report.new_followers} />
        </div>
      </CardContent>
    </Card>
  );
}

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1.5">
      <Icon aria-hidden className="h-3 w-3 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </p>
        <p className="text-sm font-semibold tabular-nums leading-tight">{formatNumber(value)}</p>
      </div>
    </div>
  );
}

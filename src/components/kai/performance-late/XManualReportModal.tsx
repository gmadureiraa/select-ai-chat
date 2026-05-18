// XManualReportModal — modal pra colar números do twitter.com/analytics.
//
// Por que: a X API custa USD 100-5000/mês. Em vez de pagar, o usuário copia
// números do dashboard nativo do X (twitter.com/i/analytics) e cola aqui.
// Os relatórios ficam persistidos em client_x_manual_reports e exibidos no
// XDashboard (que lista período + KPIs cada).
//
// Inputs todos opcionais (zero default). Período é obrigatório e validado
// (start <= end + datas não-futuras).
import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle } from 'lucide-react';
import { useCreateXManualReport } from '@/hooks/useXManualReports';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (n: number) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export function XManualReportModal({ open, onOpenChange, clientId }: Props) {
  const create = useCreateXManualReport(clientId);

  const [periodStart, setPeriodStart] = useState(daysAgoISO(28));
  const [periodEnd, setPeriodEnd] = useState(todayISO());
  const [impressions, setImpressions] = useState('');
  const [engagements, setEngagements] = useState('');
  const [likes, setLikes] = useState('');
  const [replies, setReplies] = useState('');
  const [retweets, setRetweets] = useState('');
  const [bookmarks, setBookmarks] = useState('');
  const [profileVisits, setProfileVisits] = useState('');
  const [newFollowers, setNewFollowers] = useState('');
  const [notes, setNotes] = useState('');

  const periodError = useMemo<string | null>(() => {
    if (!periodStart || !periodEnd) return 'Preencha as datas de início e fim.';
    if (periodStart > periodEnd) return 'Início precisa ser anterior (ou igual) ao fim.';
    if (periodEnd > todayISO()) return 'Fim do período não pode ser no futuro.';
    return null;
  }, [periodStart, periodEnd]);

  const reset = () => {
    setImpressions('');
    setEngagements('');
    setLikes('');
    setReplies('');
    setRetweets('');
    setBookmarks('');
    setProfileVisits('');
    setNewFollowers('');
    setNotes('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (periodError) return;
    try {
      await create.mutateAsync({
        periodStart,
        periodEnd,
        impressions: Number(impressions) || 0,
        engagements: Number(engagements) || 0,
        likes: Number(likes) || 0,
        replies: Number(replies) || 0,
        retweets: Number(retweets) || 0,
        bookmarks: Number(bookmarks) || 0,
        profileVisits: Number(profileVisits) || 0,
        newFollowers: Number(newFollowers) || 0,
        notes: notes.trim() || undefined,
      });
      reset();
      onOpenChange(false);
    } catch {
      // toast já é tratado dentro do hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar relatório manual do X</DialogTitle>
          <DialogDescription>
            Cole os números de{' '}
            <a
              href="https://twitter.com/i/analytics"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              twitter.com/i/analytics
            </a>
            . Campos vazios entram como zero. Custo da X API tornaria automação cara
            (USD 100-5000/mês), por isso esse método manual.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Período */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="x-period-start">Início do período</Label>
              <Input
                id="x-period-start"
                type="date"
                value={periodStart}
                max={periodEnd || todayISO()}
                onChange={(e) => setPeriodStart(e.target.value)}
                aria-invalid={!!periodError}
                aria-describedby={periodError ? 'x-period-error' : undefined}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="x-period-end">Fim do período</Label>
              <Input
                id="x-period-end"
                type="date"
                value={periodEnd}
                min={periodStart || undefined}
                max={todayISO()}
                onChange={(e) => setPeriodEnd(e.target.value)}
                aria-invalid={!!periodError}
                aria-describedby={periodError ? 'x-period-error' : undefined}
                required
              />
            </div>
          </div>

          {periodError && (
            <Alert variant="destructive" id="x-period-error">
              <AlertCircle aria-hidden="true" className="h-4 w-4" />
              <AlertDescription>{periodError}</AlertDescription>
            </Alert>
          )}

          {/* Métricas principais */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Métricas do período</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field id="x-imp" label="Impressões" value={impressions} onChange={setImpressions} />
              <Field id="x-eng" label="Engajamentos" value={engagements} onChange={setEngagements} />
              <Field id="x-likes" label="Curtidas" value={likes} onChange={setLikes} />
              <Field id="x-replies" label="Respostas" value={replies} onChange={setReplies} />
              <Field id="x-rt" label="Retweets" value={retweets} onChange={setRetweets} />
              <Field id="x-bm" label="Bookmarks" value={bookmarks} onChange={setBookmarks} />
              <Field id="x-pv" label="Visitas ao perfil" value={profileVisits} onChange={setProfileVisits} />
              <Field id="x-nf" label="Novos seguidores" value={newFollowers} onChange={setNewFollowers} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="x-notes">Observações (opcional)</Label>
            <Textarea
              id="x-notes"
              placeholder="Contexto do período: campanha rodando, viral inesperado, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={create.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending || !!periodError}>
              {create.isPending ? (
                <>
                  <Loader2 aria-hidden="true" className="h-4 w-4 mr-2 animate-spin" />
                  Salvando…
                </>
              ) : (
                'Salvar relatório'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// InboxStats — 4 KPIs no topo do panel de Inbox.
//   Hoje | Não lidas | Em aberto | Resposta média
import { Inbox, MailOpen, Clock, BellRing } from 'lucide-react';
import { KPICard } from '@/components/kai/performance-v2/components/KPICard';

interface Props {
  items: any[];
  loading?: boolean;
  /** Mode atual define o que é "Em aberto". Reviews não tem status — exibe — */
  mode: 'list-conversations' | 'list-comments' | 'list-reviews';
}

function isToday(value: unknown): boolean {
  if (!value) return false;
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

function pickDate(item: any): unknown {
  return (
    item?.lastMessageDate ?? item?.createdAt ?? item?.date ?? item?.timestamp ?? null
  );
}

function formatAvgResponseTime(items: any[]): string {
  // Tenta extrair `avgResponseTime` do primeiro item que tiver.
  // Metricool às vezes coloca em ms ou segundos — heurística: > 1e6 = ms.
  const sample = items.find((i) => typeof i?.avgResponseTime === 'number');
  if (!sample) return '—';
  const v = Number(sample.avgResponseTime);
  if (!Number.isFinite(v) || v <= 0) return '—';
  const seconds = v > 1e6 ? v / 1000 : v;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

export function InboxStats({ items, loading, mode }: Props) {
  const today = items.filter((i) => isToday(pickDate(i))).length;
  const unread = items.reduce(
    (acc, i) => acc + (Number(i?.unreadCount) || 0),
    0,
  );
  const open =
    mode === 'list-reviews'
      ? items.length
      : items.filter((i) => {
          const status = (i?.status ?? '').toString().toUpperCase();
          return status === 'OPEN' || status === '';
        }).length;
  const avg = formatAvgResponseTime(items);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      <KPICard
        label="Hoje"
        value={today}
        icon={<Inbox className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        label="Não lidas"
        value={unread}
        icon={<BellRing className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        label="Em aberto"
        value={open}
        icon={<MailOpen className="h-4 w-4" />}
        loading={loading}
      />
      <KPICard
        label="Resposta média"
        value={avg}
        icon={<Clock className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  );
}

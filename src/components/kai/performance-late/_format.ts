// Helpers de formatação compartilhados pelos componentes de Performance Late.
// Mantidos num módulo único porque são pequenos e usados em quase todo card.

export function formatNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export function formatPercent(n: number | null | undefined, fractionDigits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(fractionDigits)}%`;
}

export function formatDelta(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${formatNumber(n)}`;
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return iso;
  }
}

export function truncate(text: string, len = 80): string {
  if (!text) return '';
  if (text.length <= len) return text;
  return text.slice(0, len - 1) + '…';
}

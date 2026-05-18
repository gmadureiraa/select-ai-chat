// KPICard — card compacto pra mini-rows de métricas.
// Suporta loading state, trend (up/down/flat) e ícone.
import { ArrowUpRight, ArrowDownRight, Minus, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface KPICardProps {
  label: string;
  value: string | number;
  subValue?: string;
  icon?: LucideIcon;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  loading?: boolean;
  accentColor?: string;
}

export function KPICard({
  label,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  loading,
  accentColor,
}: KPICardProps) {
  if (loading) {
    return (
      <Card aria-busy="true" aria-live="polite">
        <CardContent className="p-3 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-3 w-12" />
          <span className="sr-only">Carregando {label}…</span>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon =
    trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-emerald-500'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  // ARIA label combinado pra leitor de tela ouvir "Seguidores: 12K, +200 (7d), 30d"
  const ariaSummary = [
    `${label}: ${value}`,
    trendValue ? `Variação ${trendValue}` : null,
    subValue ? `Contexto ${subValue}` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Card role="group" aria-label={ariaSummary}>
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">
            {label}
          </span>
          {Icon && (
            <Icon
              aria-hidden="true"
              className="h-3.5 w-3.5 shrink-0"
              style={accentColor ? { color: accentColor } : { color: 'hsl(var(--muted-foreground))' }}
            />
          )}
        </div>
        <div className="text-xl font-semibold tabular-nums leading-tight">{value}</div>
        {(subValue || trendValue) && (
          <div className="flex items-center gap-1.5 text-[11px]">
            {trendValue && trend && (
              <span className={cn('flex items-center gap-0.5 font-medium', trendColor)}>
                <TrendIcon aria-hidden="true" className="h-3 w-3" />
                {trendValue}
              </span>
            )}
            {subValue && <span className="text-muted-foreground">{subValue}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// TimeSeriesCharts — 4 charts grandes ao longo do tempo:
//   1. Seguidores (de followersHistory)
//   2. Engajamento (likes+comments+shares agregado por dia)
//   3. Curtidas (agregado por dia)
//   4. Comentários (agregado por dia)
//
// Charts usam recharts <AreaChart>. Mantém preenchimento gradient pra dar
// peso visual. Tooltip pt-BR. Responsive container.
import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Heart, MessageCircle, TrendingUp } from 'lucide-react';
import { type MetricoolPost, getPostMetric } from '@/hooks/useMetricoolPerformance';

interface FollowersPoint {
  date: string;
  followers: number;
}

interface Props {
  posts: MetricoolPost[];
  followersHistory: FollowersPoint[];
  loading?: boolean;
  period: number;
}

interface DayBucket {
  date: string;
  shortDate: string;
  posts: number;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
}

function bucketByDay(posts: MetricoolPost[], period: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  const now = new Date();
  // Inicializa todos os dias do período (mesmo sem posts) pra chart contínuo
  for (let i = period - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      shortDate: d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      posts: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      engagement: 0,
    });
  }

  for (const p of posts) {
    const dateStr = (p.date || p.publishedAt || p.publishDate || '') as string;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) continue;
    const key = d.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (!b) continue; // fora do range
    b.posts += 1;
    b.likes += getPostMetric(p, 'likes');
    b.comments += getPostMetric(p, 'comments');
    b.shares += getPostMetric(p, 'shares');
    b.engagement = b.likes + b.comments + b.shares;
  }

  return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function fmtNumber(n: number) {
  return new Intl.NumberFormat('pt-BR').format(n);
}

interface ChartCardProps {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  data: Array<{ shortDate: string; date: string; value: number }>;
  color: string; // hex
  loading?: boolean;
  total?: number;
  unit?: string;
}

function ChartCard({ title, icon: Icon, data, color, loading, total, unit }: ChartCardProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[180px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.value > 0);
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const id = `gradient-${title.replace(/\s/g, '')}`;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4" style={{ color }} />
            <span className="text-sm font-semibold">{title}</span>
          </div>
          {typeof total === 'number' && (
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">
                {fmtNumber(total)}
                {unit && <span className="text-xs text-muted-foreground ml-1">{unit}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">no período</div>
            </div>
          )}
        </div>

        {!hasData ? (
          <div className="flex items-center justify-center h-[160px] text-xs text-muted-foreground">
            Sem dados nesse período.
          </div>
        ) : (
          <div className="h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                    <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="shortDate"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, maxVal * 1.15]}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                  tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  formatter={(value: number) => [fmtNumber(value) + (unit || ''), title]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function TimeSeriesCharts({ posts, followersHistory, loading, period }: Props) {
  const buckets = useMemo(() => bucketByDay(posts, period), [posts, period]);

  // Followers — vem do summary já formatado em {date, followers}
  const followersSeries = useMemo(() => {
    return followersHistory.map((p) => ({
      shortDate: new Date(p.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      date: p.date,
      value: p.followers,
    }));
  }, [followersHistory]);

  const engagementSeries = buckets.map((b) => ({
    shortDate: b.shortDate,
    date: b.date,
    value: b.engagement,
  }));
  const likesSeries = buckets.map((b) => ({
    shortDate: b.shortDate,
    date: b.date,
    value: b.likes,
  }));
  const commentsSeries = buckets.map((b) => ({
    shortDate: b.shortDate,
    date: b.date,
    value: b.comments,
  }));

  const totalEng = buckets.reduce((acc, b) => acc + b.engagement, 0);
  const totalLikes = buckets.reduce((acc, b) => acc + b.likes, 0);
  const totalComments = buckets.reduce((acc, b) => acc + b.comments, 0);
  const followersCurrent = followersSeries[followersSeries.length - 1]?.value ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <ChartCard
        title="Seguidores ao longo do tempo"
        icon={Users}
        data={followersSeries}
        color="#6366f1"
        loading={loading}
        total={followersCurrent}
      />
      <ChartCard
        title="Engajamento ao longo do tempo"
        icon={TrendingUp}
        data={engagementSeries}
        color="#10b981"
        loading={loading}
        total={totalEng}
      />
      <ChartCard
        title="Curtidas ao longo do tempo"
        icon={Heart}
        data={likesSeries}
        color="#ef4444"
        loading={loading}
        total={totalLikes}
      />
      <ChartCard
        title="Comentários ao longo do tempo"
        icon={MessageCircle}
        data={commentsSeries}
        color="#0ea5e9"
        loading={loading}
        total={totalComments}
      />
    </div>
  );
}

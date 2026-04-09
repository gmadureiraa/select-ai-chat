import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, startOfWeek, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PostWithMetrics {
  posted_at?: string | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  reach?: number | null;
  impressions?: number | null;
  engagement_rate?: number | null;
}

interface PostAveragesTrendChartProps {
  posts: PostWithMetrics[];
}

const metrics = [
  { key: "likes", label: "Curtidas", color: "hsl(var(--chart-1))" },
  { key: "comments", label: "Comentários", color: "hsl(var(--chart-2))" },
  { key: "shares", label: "Compartilh.", color: "hsl(var(--chart-3))" },
  { key: "saves", label: "Salvos", color: "hsl(var(--chart-4))" },
  { key: "reach", label: "Alcance", color: "hsl(var(--chart-5))" },
  { key: "impressions", label: "Impressões", color: "hsl(var(--primary))" },
  { key: "engagement", label: "Engajamento %", color: "hsl(var(--chart-6, var(--primary)))" },
];

export function PostAveragesTrendChart({ posts }: PostAveragesTrendChartProps) {
  const [selectedMetric, setSelectedMetric] = useState("likes");
  const [groupBy, setGroupBy] = useState<"week" | "month">("week");

  const chartData = useMemo(() => {
    const postsWithDate = posts
      .filter(p => p.posted_at)
      .sort((a, b) => new Date(a.posted_at!).getTime() - new Date(b.posted_at!).getTime());

    if (postsWithDate.length === 0) return [];

    const groups: Record<string, PostWithMetrics[]> = {};

    postsWithDate.forEach(post => {
      const date = new Date(post.posted_at!);
      const key = groupBy === "week"
        ? format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd")
        : format(startOfMonth(date), "yyyy-MM");
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(post);
    });

    return Object.entries(groups).map(([key, groupPosts]) => {
      const count = groupPosts.length;
      const label = groupBy === "week"
        ? format(new Date(key), "dd MMM", { locale: ptBR })
        : format(new Date(key + "-01"), "MMM yyyy", { locale: ptBR });

      return {
        date: label,
        likes: Math.round(groupPosts.reduce((s, p) => s + (p.likes || 0), 0) / count),
        comments: Math.round(groupPosts.reduce((s, p) => s + (p.comments || 0), 0) / count),
        shares: Math.round(groupPosts.reduce((s, p) => s + (p.shares || 0), 0) / count),
        saves: Math.round(groupPosts.reduce((s, p) => s + (p.saves || 0), 0) / count),
        reach: Math.round(groupPosts.reduce((s, p) => s + (p.reach || 0), 0) / count),
        impressions: Math.round(groupPosts.reduce((s, p) => s + (p.impressions || 0), 0) / count),
        engagement: +(groupPosts.reduce((s, p) => s + (p.engagement_rate || 0), 0) / count).toFixed(2),
        posts: count,
      };
    });
  }, [posts, groupBy]);

  const current = metrics.find(m => m.key === selectedMetric) || metrics[0];

  if (chartData.length < 2) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
      <div className="bg-card border border-border rounded-lg shadow-elevated p-3 min-w-[140px]">
        <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mb-2">{data?.posts} post(s)</p>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: current.color }} />
            <span className="text-xs text-muted-foreground">{current.label}</span>
          </div>
          <span className="text-sm font-semibold" style={{ color: current.color }}>
            {selectedMetric === "engagement" 
              ? `${payload[0].value}%` 
              : payload[0].value?.toLocaleString("pt-BR")}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Médias por Post ao Longo do Tempo
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              type="single"
              value={groupBy}
              onValueChange={(v) => v && setGroupBy(v as "week" | "month")}
              className="bg-muted/50 p-0.5 rounded-md"
            >
              <ToggleGroupItem value="week" className="text-xs px-2.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Semana
              </ToggleGroupItem>
              <ToggleGroupItem value="month" className="text-xs px-2.5 h-7 data-[state=on]:bg-background data-[state=on]:shadow-sm">
                Mês
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
        <ToggleGroup
          type="single"
          value={selectedMetric}
          onValueChange={(v) => v && setSelectedMetric(v)}
          className="bg-muted/50 p-1 rounded-lg flex-wrap gap-0.5 justify-start mt-2"
        >
          {metrics.map((m) => (
            <ToggleGroupItem
              key={m.key}
              value={m.key}
              className="text-xs px-2.5 h-7 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground transition-all"
            >
              {m.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </CardHeader>
      <CardContent className="pt-4 px-2 sm:px-4">
        <ChartContainer
          config={{ [current.key]: { label: current.label, color: current.color } }}
          className="h-[280px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`avgGradient-${current.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={current.color} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={current.color} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={current.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickMargin={10}
                width={45}
                tickFormatter={(v) => {
                  if (selectedMetric === "engagement") return `${v}%`;
                  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  return v.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={current.key}
                name={current.label}
                stroke={current.color}
                strokeWidth={2}
                fill={`url(#avgGradient-${current.key})`}
                dot={chartData.length <= 30 ? { r: 2.5, fill: current.color, stroke: "hsl(var(--background))", strokeWidth: 2 } : false}
                activeDot={{ r: 5, stroke: current.color, strokeWidth: 2, fill: "hsl(var(--background))" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

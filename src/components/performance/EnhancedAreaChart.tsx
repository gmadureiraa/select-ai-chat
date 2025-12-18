import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart } from "recharts";
import { useMemo } from "react";

interface MetricConfig {
  key: string;
  label: string;
  dataKey: string;
  color: string;
}

interface EnhancedAreaChartProps {
  data: any[];
  metrics: MetricConfig[];
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  title?: string;
  dateRange?: string;
  showMultipleLines?: boolean;
}

// Vibrant color palette for multiple lines
const multiLineColors = [
  "hsl(145, 75%, 45%)",  // Green
  "hsl(330, 85%, 55%)",  // Pink
  "hsl(220, 90%, 55%)",  // Blue
  "hsl(25, 95%, 55%)",   // Orange
  "hsl(270, 75%, 60%)",  // Purple
  "hsl(185, 75%, 45%)",  // Cyan
];

export function EnhancedAreaChart({
  data,
  metrics,
  selectedMetric,
  onMetricChange,
  title,
  dateRange,
  showMultipleLines = false,
}: EnhancedAreaChartProps) {
  // Get current metric, fallback to first available if selected not available
  const currentMetric = useMemo(() => {
    const found = metrics.find(m => m.key === selectedMetric);
    if (found) return found;
    return metrics[0] || null;
  }, [metrics, selectedMetric]);

  // Calculate summary values for each metric
  const metricSummaries = useMemo(() => {
    const summaries: Record<string, number> = {};
    metrics.forEach(m => {
      const values = data.map(d => d[m.dataKey] || 0).filter(v => v > 0);
      
      const isRateMetric = m.key.toLowerCase().includes('rate') || 
                           m.label.toLowerCase().includes('%') ||
                           m.label.toLowerCase().includes('taxa');
      
      const isCumulativeMetric = m.key === 'subscribers' || 
                                 m.key === 'followers' ||
                                 m.key.toLowerCase().includes('inscritos');
      
      if (values.length === 0) {
        summaries[m.key] = 0;
      } else if (isRateMetric) {
        summaries[m.key] = values.reduce((a, b) => a + b, 0) / values.length;
      } else if (isCumulativeMetric) {
        summaries[m.key] = values[values.length - 1] || 0;
      } else {
        summaries[m.key] = values.reduce((a, b) => a + b, 0);
      }
    });
    return summaries;
  }, [data, metrics]);

  const formatSummary = (num: number, metricKey: string) => {
    const isRateMetric = metricKey.toLowerCase().includes('rate') || 
                         metrics.find(m => m.key === metricKey)?.label.toLowerCase().includes('%');
    
    if (isRateMetric) return `${num.toFixed(1)}%`;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString('pt-BR');
  };

  if (!currentMetric) return null;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card border border-border rounded-lg shadow-elevated p-3 min-w-[140px]">
        <p className="text-xs text-muted-foreground mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">{entry.name}</span>
            </div>
            <span className="text-sm font-semibold" style={{ color: entry.color }}>
              {entry.value?.toLocaleString('pt-BR')}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="border border-border/50 bg-card shadow-card overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-base font-semibold">
              {title || currentMetric.label}
            </CardTitle>
            {dateRange && (
              <CardDescription className="text-xs mt-0.5">{dateRange}</CardDescription>
            )}
          </div>
          <ToggleGroup 
            type="single" 
            value={selectedMetric} 
            onValueChange={(v) => v && onMetricChange(v)}
            className="bg-muted/50 p-1 rounded-lg flex-wrap gap-0.5"
          >
            {metrics.map((metric) => (
              <ToggleGroupItem 
                key={metric.key} 
                value={metric.key} 
                className="text-xs px-2.5 h-7 data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground transition-all"
              >
                <span className="text-inherit font-medium">{metric.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-2 sm:px-4">
        <ChartContainer
          config={{
            [currentMetric.dataKey]: { 
              label: currentMetric.label, 
              color: currentMetric.color 
            },
          }}
          className="h-[320px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`chartGradient-${currentMetric.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentMetric.color} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={currentMetric.color} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={currentMetric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.5}
                vertical={false} 
              />
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickMargin={10}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                tickMargin={10}
                width={45}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={currentMetric.dataKey}
                name={currentMetric.label}
                stroke={currentMetric.color}
                strokeWidth={2}
                fill={`url(#chartGradient-${currentMetric.key})`}
                dot={data.length <= 30 ? { 
                  r: 2.5, 
                  fill: currentMetric.color,
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2
                } : false}
                activeDot={{ 
                  r: 5, 
                  stroke: currentMetric.color, 
                  strokeWidth: 2, 
                  fill: 'hsl(var(--background))',
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer } from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
}

export function EnhancedAreaChart({
  data,
  metrics,
  selectedMetric,
  onMetricChange,
  title,
  dateRange,
}: EnhancedAreaChartProps) {
  const currentMetric = useMemo(() => 
    metrics.find(m => m.key === selectedMetric) || metrics[0],
    [metrics, selectedMetric]
  );

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[140px]">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-lg font-semibold" style={{ color: currentMetric.color }}>
          {payload[0]?.value?.toLocaleString('pt-BR')}
        </p>
        <p className="text-xs text-muted-foreground">{currentMetric.label}</p>
      </div>
    );
  };

  return (
    <Card className="border-border/50 bg-card/50 overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle className="text-lg font-semibold">
              {title || currentMetric.label}
            </CardTitle>
            {dateRange && (
              <CardDescription className="text-xs mt-1">{dateRange}</CardDescription>
            )}
          </div>
          <ToggleGroup 
            type="single" 
            value={selectedMetric} 
            onValueChange={(v) => v && onMetricChange(v)}
            className="bg-muted/50 p-1 rounded-lg"
          >
            {metrics.map((metric) => (
              <ToggleGroupItem 
                key={metric.key} 
                value={metric.key} 
                className="text-xs px-3 h-8 data-[state=on]:bg-background data-[state=on]:shadow-sm transition-all"
              >
                {metric.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer
          config={{
            [currentMetric.dataKey]: { 
              label: currentMetric.label, 
              color: currentMetric.color 
            },
          }}
          className="h-[300px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={currentMetric.color} stopOpacity={0.3} />
                  <stop offset="50%" stopColor={currentMetric.color} stopOpacity={0.1} />
                  <stop offset="100%" stopColor={currentMetric.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                strokeOpacity={0.3}
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
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  return value.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey={currentMetric.dataKey}
                stroke={currentMetric.color}
                strokeWidth={2.5}
                fill="url(#chartGradient)"
                dot={data.length <= 30 ? { 
                  r: 3, 
                  fill: currentMetric.color,
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2
                } : false}
                activeDot={{ 
                  r: 6, 
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

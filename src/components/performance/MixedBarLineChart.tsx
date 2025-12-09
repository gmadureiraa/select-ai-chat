import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer } from "@/components/ui/chart";
import { Bar, Line, ComposedChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

interface MixedBarLineChartProps {
  data: any[];
  barDataKey: string;
  barLabel: string;
  barColor: string;
  lineDataKey: string;
  lineLabel: string;
  lineColor: string;
  title?: string;
  timeframe?: "daily" | "weekly" | "monthly";
  onTimeframeChange?: (timeframe: "daily" | "weekly" | "monthly") => void;
}

export function MixedBarLineChart({
  data,
  barDataKey,
  barLabel,
  barColor,
  lineDataKey,
  lineLabel,
  lineColor,
  title,
  timeframe = "daily",
  onTimeframeChange,
}: MixedBarLineChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    
    return (
      <div className="bg-card border border-border rounded-lg shadow-xl p-3 min-w-[160px]">
        <p className="text-xs text-muted-foreground mb-2">{label}</p>
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
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg font-semibold">{title || "Performance"}</CardTitle>
          {onTimeframeChange && (
            <ToggleGroup 
              type="single" 
              value={timeframe} 
              onValueChange={(v) => v && onTimeframeChange(v as any)}
              className="bg-muted/50 p-1 rounded-lg"
            >
              <ToggleGroupItem value="daily" className="text-xs px-3 h-7">
                Diário
              </ToggleGroupItem>
              <ToggleGroupItem value="weekly" className="text-xs px-3 h-7">
                Semanal
              </ToggleGroupItem>
              <ToggleGroupItem value="monthly" className="text-xs px-3 h-7">
                Mensal
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <ChartContainer
          config={{
            [barDataKey]: { label: barLabel, color: barColor },
            [lineDataKey]: { label: lineLabel, color: lineColor },
          }}
          className="h-[280px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickMargin={8}
              />
              <YAxis 
                yAxisId="left"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                  if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                  return value.toString();
                }}
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickFormatter={(value) => {
                  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                  return value.toString();
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                yAxisId="left"
                dataKey={barDataKey} 
                name={barLabel}
                fill={barColor} 
                radius={[4, 4, 0, 0]}
                opacity={0.8}
              />
              <Line 
                yAxisId="right"
                type="monotone"
                dataKey={lineDataKey} 
                name={lineLabel}
                stroke={lineColor} 
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, stroke: lineColor, strokeWidth: 2, fill: 'hsl(var(--background))' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
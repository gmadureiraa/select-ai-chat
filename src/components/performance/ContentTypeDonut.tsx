import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

interface ContentTypeData {
  type: string;
  count: number;
  engagement?: number;
  color?: string;
}

interface ContentTypeDonutProps {
  title?: string;
  data: ContentTypeData[];
  showEngagement?: boolean;
}

const defaultColors = [
  "hsl(270, 70%, 55%)", // violet
  "hsl(350, 80%, 55%)", // rose
  "hsl(45, 80%, 50%)",  // amber
  "hsl(200, 80%, 55%)", // blue
  "hsl(145, 80%, 45%)", // emerald
  "hsl(320, 70%, 55%)", // pink
];

const typeLabels: Record<string, string> = {
  image: "Feed",
  carousel: "Carrossel",
  reel: "Reels",
  video: "Vídeo",
  story: "Stories",
  other: "Outros",
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;

  const data = payload[0].payload;
  return (
    <div className="bg-popover/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg p-3">
      <p className="text-sm font-medium">{data.label}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {data.count} posts ({data.percentage.toFixed(1)}%)
        </p>
        {data.engagement !== undefined && (
          <p className="text-xs text-muted-foreground">
            Eng. médio: {data.engagement.toFixed(2)}%
          </p>
        )}
      </div>
    </div>
  );
};

export function ContentTypeDonut({ 
  title = "Tipos de Conteúdo",
  data,
  showEngagement = true
}: ContentTypeDonutProps) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  const chartData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      label: typeLabels[d.type] || d.type,
      percentage: total > 0 ? (d.count / total) * 100 : 0,
      color: d.color || defaultColors[i % defaultColors.length],
    }));
  }, [data, total]);

  // Find best performing type
  const bestType = useMemo(() => {
    if (!showEngagement) return null;
    return chartData.reduce((best, current) => 
      (current.engagement || 0) > (best?.engagement || 0) ? current : best
    , chartData[0]);
  }, [chartData, showEngagement]);

  if (data.length === 0) {
    return (
      <Card className="border-border/30 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            Sem dados disponíveis
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut chart */}
          <div className="w-32 h-32 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={55}
                  paddingAngle={2}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-2">
            {chartData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm">{item.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{item.count}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {item.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Best performing type */}
        {bestType && bestType.engagement !== undefined && (
          <div className="mt-4 pt-3 border-t border-border/30">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Melhor performance:</span>
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: bestType.color }}
                />
                <span className="font-medium">{bestType.label}</span>
                <span className="text-emerald-500 text-xs font-medium">
                  {bestType.engagement?.toFixed(2)}% eng.
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

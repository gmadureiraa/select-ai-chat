import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HeatmapData {
  day: number; // 0-6 (Sunday-Saturday)
  hour: number; // 0-23
  value: number;
}

interface PostingTimeHeatmapProps {
  title?: string;
  data: HeatmapData[];
  colorScale?: string[];
}

const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hourLabels = ["00h", "03h", "06h", "09h", "12h", "15h", "18h", "21h"];

export function PostingTimeHeatmap({ 
  title = "Melhor Horário para Postar",
  data,
  colorScale = [
    "bg-emerald-500/10",
    "bg-emerald-500/25",
    "bg-emerald-500/40",
    "bg-emerald-500/60",
    "bg-emerald-500/80",
    "bg-emerald-500",
  ]
}: PostingTimeHeatmapProps) {
  // Create a 7x24 grid from data
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    let maxValue = 0;

    data.forEach(item => {
      if (item.day >= 0 && item.day < 7 && item.hour >= 0 && item.hour < 24) {
        grid[item.day][item.hour] = item.value;
        maxValue = Math.max(maxValue, item.value);
      }
    });

    return { grid, maxValue };
  }, [data]);

  const getColorClass = (value: number) => {
    if (value === 0 || heatmapGrid.maxValue === 0) return colorScale[0];
    const intensity = Math.ceil((value / heatmapGrid.maxValue) * (colorScale.length - 1));
    return colorScale[Math.min(intensity, colorScale.length - 1)];
  };

  // Find best time
  const bestTime = useMemo(() => {
    let best = { day: 0, hour: 0, value: 0 };
    heatmapGrid.grid.forEach((dayData, dayIndex) => {
      dayData.forEach((value, hourIndex) => {
        if (value > best.value) {
          best = { day: dayIndex, hour: hourIndex, value };
        }
      });
    });
    return best;
  }, [heatmapGrid]);

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {bestTime.value > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Melhor:</span>
              <span className="text-xs font-semibold text-emerald-500">
                {dayLabels[bestTime.day]} às {bestTime.hour}h
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {/* Hour labels */}
          <div className="flex gap-0.5 ml-10">
            {hourLabels.map((label, i) => (
              <div 
                key={label} 
                className="text-[10px] text-muted-foreground text-center"
                style={{ width: `${100 / 8}%` }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {heatmapGrid.grid.map((dayData, dayIndex) => (
            <div key={dayIndex} className="flex items-center gap-1">
              <div className="w-8 text-xs text-muted-foreground text-right pr-1">
                {dayLabels[dayIndex]}
              </div>
              <div className="flex-1 flex gap-0.5">
                {dayData.map((value, hourIndex) => (
                  <div
                    key={hourIndex}
                    className={cn(
                      "flex-1 h-5 rounded-sm transition-colors cursor-pointer",
                      getColorClass(value),
                      bestTime.day === dayIndex && bestTime.hour === hourIndex && "ring-1 ring-emerald-500"
                    )}
                    title={`${dayLabels[dayIndex]} ${hourIndex}h: ${value} engajamentos`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-3 pt-2">
            <span className="text-[10px] text-muted-foreground">Menor</span>
            <div className="flex gap-0.5">
              {colorScale.map((color, i) => (
                <div key={i} className={cn("w-4 h-3 rounded-sm", color)} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground">Maior</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

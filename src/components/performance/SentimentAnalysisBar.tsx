import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmilePlus, Meh, Frown } from "lucide-react";

interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
}

interface SentimentAnalysisBarProps {
  data: SentimentData;
  title?: string;
  showCounts?: boolean;
}

export function SentimentAnalysisBar({ 
  data, 
  title = "Análise de Sentimento",
  showCounts = true 
}: SentimentAnalysisBarProps) {
  const total = data.positive + data.neutral + data.negative;
  
  const percentages = useMemo(() => {
    if (total === 0) return { positive: 33.33, neutral: 33.33, negative: 33.34 };
    return {
      positive: (data.positive / total) * 100,
      neutral: (data.neutral / total) * 100,
      negative: (data.negative / total) * 100,
    };
  }, [data, total]);

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Percentage labels */}
        <div className="flex justify-between text-xs font-medium">
          <span className="text-emerald-500">{percentages.positive.toFixed(1)}%</span>
          <span className="text-slate-400">{percentages.neutral.toFixed(1)}%</span>
          <span className="text-rose-500">{percentages.negative.toFixed(1)}%</span>
        </div>

        {/* Segmented bar */}
        <div className="h-3 rounded-full overflow-hidden flex bg-muted/30">
          <div 
            className="bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500"
            style={{ width: `${percentages.positive}%` }}
          />
          <div 
            className="bg-gradient-to-r from-slate-300 to-slate-400 transition-all duration-500"
            style={{ width: `${percentages.neutral}%` }}
          />
          <div 
            className="bg-gradient-to-r from-rose-400 to-rose-500 transition-all duration-500"
            style={{ width: `${percentages.negative}%` }}
          />
        </div>

        {/* Legend with counts */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <SmilePlus className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Positivo</span>
              {showCounts && (
                <span className="text-sm font-semibold">{data.positive.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-400/10 flex items-center justify-center">
              <Meh className="h-4 w-4 text-slate-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Neutro</span>
              {showCounts && (
                <span className="text-sm font-semibold">{data.neutral.toLocaleString()}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
              <Frown className="h-4 w-4 text-rose-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Negativo</span>
              {showCounts && (
                <span className="text-sm font-semibold">{data.negative.toLocaleString()}</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

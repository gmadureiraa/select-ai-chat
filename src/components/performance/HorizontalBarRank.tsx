import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface RankItem {
  label: string;
  value: number;
  color?: string;
  icon?: React.ReactNode;
}

interface HorizontalBarRankProps {
  title: string;
  items: RankItem[];
  maxItems?: number;
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
}

const defaultColors = [
  "bg-violet-500",
  "bg-rose-500", 
  "bg-amber-500",
  "bg-emerald-500",
  "bg-blue-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-orange-500",
];

export function HorizontalBarRank({ 
  title, 
  items, 
  maxItems = 5,
  showValues = true,
  valueFormatter = (v) => v.toLocaleString()
}: HorizontalBarRankProps) {
  const displayItems = items.slice(0, maxItems);
  const maxValue = Math.max(...items.map(i => i.value), 1);

  return (
    <Card className="border-border/30 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayItems.map((item, index) => {
          const percentage = (item.value / maxValue) * 100;
          const colorClass = item.color || defaultColors[index % defaultColors.length];
          
          return (
            <div key={item.label} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {item.icon && <span className="text-muted-foreground">{item.icon}</span>}
                  <span className="font-medium truncate max-w-[180px]">{item.label}</span>
                </div>
                {showValues && (
                  <span className="text-muted-foreground text-xs font-medium">
                    {valueFormatter(item.value)}
                  </span>
                )}
              </div>
              <div className="h-2.5 rounded-full overflow-hidden bg-muted/30">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-700 ease-out",
                    colorClass
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Sem dados disponíveis
          </div>
        )}
      </CardContent>
    </Card>
  );
}

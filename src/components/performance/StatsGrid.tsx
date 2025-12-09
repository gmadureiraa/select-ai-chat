import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface StatItem {
  label: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  color: string;
  sparklineData?: number[];
}

interface StatsGridProps {
  stats: StatItem[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ value, index }));
  
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`sparkGradient-${color}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#sparkGradient-${color})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-border/50 bg-card/50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-2">
                <div 
                  className="p-2 rounded-lg"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <Icon className="h-4 w-4" style={{ color: stat.color }} />
                </div>
                {stat.sparklineData && stat.sparklineData.length > 0 && (
                  <MiniSparkline data={stat.sparklineData} color={stat.color} />
                )}
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-bold">
                  {typeof stat.value === 'number' 
                    ? stat.value.toLocaleString('pt-BR') 
                    : stat.value}
                </p>
                {stat.change !== undefined && (
                  <div className={`flex items-center gap-1 text-xs ${
                    stat.change >= 0 ? 'text-emerald-500' : 'text-red-500'
                  }`}>
                    {stat.change >= 0 
                      ? <TrendingUp className="h-3 w-3" /> 
                      : <TrendingDown className="h-3 w-3" />
                    }
                    <span>{stat.change >= 0 ? '+' : ''}{stat.change.toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
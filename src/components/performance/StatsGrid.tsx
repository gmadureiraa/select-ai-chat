import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatItem {
  label: string;
  value: string | number;
  change?: number;
  previousValue?: number;
  icon: LucideIcon;
  color: string;
  sparklineData?: number[];
  platform?: string;
}

interface StatsGridProps {
  stats: StatItem[];
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((value, index) => ({ value, index }));
  const uniqueId = `sparkGradient-${color.replace(/[^a-zA-Z0-9]/g, '')}-${Math.random().toString(36).slice(2, 9)}`;
  
  return (
    <div className="w-20 h-10">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={uniqueId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${uniqueId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        const isPositive = stat.change !== undefined && stat.change >= 0;
        const isNeutral = stat.change === 0;
        
        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.08 }}
          >
            <Card className={cn(
              "border-border/50 bg-card/50 overflow-hidden transition-all duration-200",
              "hover:border-border hover:shadow-md hover:scale-[1.01]"
            )}>
              <CardContent className="p-5">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div 
                    className="p-2.5 rounded-xl"
                    style={{ backgroundColor: `${stat.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: stat.color }} />
                  </div>
                  {stat.sparklineData && stat.sparklineData.length > 0 && (
                    <MiniSparkline data={stat.sparklineData} color={stat.color} />
                  )}
                </div>
                
                {/* Content */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    {stat.platform && (
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 bg-muted/50 px-1.5 py-0.5 rounded">
                        {stat.platform}
                      </span>
                    )}
                  </div>
                  
                  {/* Value Row with Change */}
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-bold tracking-tight">
                      {typeof stat.value === 'number' 
                        ? stat.value.toLocaleString('pt-BR') 
                        : stat.value}
                    </p>
                    
                    {stat.change !== undefined && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                        isNeutral 
                          ? "text-muted-foreground bg-muted/50"
                          : isPositive 
                            ? "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400" 
                            : "text-red-600 bg-red-500/10 dark:text-red-400"
                      )}>
                        {isNeutral ? (
                          <Minus className="h-3 w-3" />
                        ) : isPositive ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        <span>{isPositive && !isNeutral ? '+' : ''}{stat.change.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Previous Value (optional) */}
                  {stat.previousValue !== undefined && (
                    <p className="text-[10px] text-muted-foreground/60">
                      Período anterior: {stat.previousValue.toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}
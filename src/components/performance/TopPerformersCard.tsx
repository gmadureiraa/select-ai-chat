import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";

interface TopPerformer {
  id: string;
  title: string;
  subtitle?: string;
  value: number;
  maxValue: number;
  imageUrl?: string;
  platform?: string;
}

interface TopPerformersCardProps {
  title: string;
  performers: TopPerformer[];
  formatValue?: (value: number) => string;
}

const rankIcons = [Trophy, Medal, Award];
const rankColors = [
  "text-amber-500 bg-amber-500/10 border-amber-500/30",
  "text-slate-400 bg-slate-400/10 border-slate-400/30",
  "text-orange-600 bg-orange-600/10 border-orange-600/30",
];

export function TopPerformersCard({ title, performers, formatValue }: TopPerformersCardProps) {
  const format = formatValue || ((v) => v.toLocaleString("pt-BR"));

  return (
    <Card className="border-border/50 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {performers.slice(0, 5).map((performer, index) => {
          const RankIcon = rankIcons[index] || Award;
          const progress = (performer.value / performer.maxValue) * 100;

          return (
            <div
              key={performer.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border transition-all hover:shadow-sm",
                index < 3 ? rankColors[index] : "bg-muted/30 border-border/50"
              )}
            >
              {/* Rank Badge */}
              <div className={cn(
                "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold",
                index < 3 ? "" : "bg-muted text-muted-foreground"
              )}>
                {index < 3 ? (
                  <RankIcon className="h-4 w-4" />
                ) : (
                  <span>{index + 1}º</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar className="h-10 w-10 rounded-lg">
                <AvatarImage src={performer.imageUrl} alt={performer.title} className="object-cover" />
                <AvatarFallback className="rounded-lg bg-gradient-to-br from-primary/80 to-secondary/80 text-white text-xs font-bold">
                  {performer.title.charAt(0)}
                </AvatarFallback>
              </Avatar>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{performer.title}</p>
                {performer.subtitle && (
                  <p className="text-xs text-muted-foreground truncate">{performer.subtitle}</p>
                )}
                {/* Progress Bar */}
                <div className="mt-1.5 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      index === 0 ? "bg-amber-500" : index === 1 ? "bg-slate-400" : index === 2 ? "bg-orange-600" : "bg-primary/60"
                    )}
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              {/* Value */}
              <div className="text-right">
                <p className="text-sm font-bold">{format(performer.value)}</p>
                {performer.platform && (
                  <p className="text-[10px] text-muted-foreground uppercase">{performer.platform}</p>
                )}
              </div>
            </div>
          );
        })}

        {performers.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Sem dados ainda</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
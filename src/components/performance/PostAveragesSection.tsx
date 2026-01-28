import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, MessageCircle, Share2, Bookmark, Target, Eye, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PostAveragesSectionProps {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  totalSaves: number;
  totalReach: number;
  totalImpressions: number;
  avgEngagement: number;
}

interface AverageCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tooltip?: string;
  color?: string;
}

function AverageCard({ icon: Icon, label, value, tooltip, color = "text-muted-foreground" }: AverageCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-default">
          <Icon className={`h-4 w-4 ${color} mb-1.5`} />
          <span className="text-lg font-semibold">{value}</span>
          <span className="text-[10px] text-muted-foreground text-center leading-tight">{label}</span>
        </div>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent>
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function PostAveragesSection({
  totalPosts,
  totalLikes,
  totalComments,
  totalShares,
  totalSaves,
  totalReach,
  totalImpressions,
  avgEngagement,
}: PostAveragesSectionProps) {
  if (totalPosts === 0) return null;

  const formatAvg = (total: number) => {
    const avg = total / totalPosts;
    if (avg >= 1000) {
      return `${(avg / 1000).toFixed(1)}k`;
    }
    return avg.toFixed(avg >= 100 ? 0 : 1);
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Médias por Post
          <span className="text-xs font-normal text-muted-foreground ml-2">
            ({totalPosts} posts)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
          <AverageCard
            icon={Heart}
            label="Curtidas/Post"
            value={formatAvg(totalLikes)}
            tooltip={`Total: ${totalLikes.toLocaleString()} curtidas`}
            color="text-rose-500"
          />
          <AverageCard
            icon={MessageCircle}
            label="Comentários/Post"
            value={formatAvg(totalComments)}
            tooltip={`Total: ${totalComments.toLocaleString()} comentários`}
            color="text-blue-500"
          />
          <AverageCard
            icon={Share2}
            label="Compart./Post"
            value={formatAvg(totalShares)}
            tooltip={`Total: ${totalShares.toLocaleString()} compartilhamentos`}
            color="text-emerald-500"
          />
          <AverageCard
            icon={Bookmark}
            label="Salvos/Post"
            value={formatAvg(totalSaves)}
            tooltip={`Total: ${totalSaves.toLocaleString()} salvamentos`}
            color="text-amber-500"
          />
          <AverageCard
            icon={Target}
            label="Contas alc./Post"
            value={formatAvg(totalReach)}
            tooltip={`Total: ${totalReach.toLocaleString()} contas alcançadas`}
            color="text-purple-500"
          />
          <AverageCard
            icon={Eye}
            label="Impressões/Post"
            value={formatAvg(totalImpressions)}
            tooltip={`Total: ${totalImpressions.toLocaleString()} impressões`}
            color="text-violet-500"
          />
          <AverageCard
            icon={TrendingUp}
            label="Engaj. Médio"
            value={`${avgEngagement.toFixed(2)}%`}
            tooltip="Taxa de engajamento média dos posts"
            color="text-primary"
          />
        </div>
      </CardContent>
    </Card>
  );
}

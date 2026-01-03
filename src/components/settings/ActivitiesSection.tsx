import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Clock, User, FileText, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const activityIcons: Record<string, React.ReactNode> = {
  client_created: <FileText className="h-4 w-4" />,
  content_generated: <Zap className="h-4 w-4" />,
  automation_run: <Zap className="h-4 w-4" />,
  default: <Activity className="h-4 w-4" />,
};

export function ActivitiesSection() {
  const { user } = useAuth();

  const { data: activities, isLoading } = useQuery({
    queryKey: ["user-activities", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from("user_activities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Atividades Recentes</CardTitle>
        </div>
        <CardDescription>Histórico de ações realizadas na plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Suas ações aparecerão aqui conforme você usa a plataforma.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary">
                  {activityIcons[activity.activity_type] || activityIcons.default}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {activity.description}
                  </p>
                  {activity.entity_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.entity_type}: {activity.entity_name}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground/70">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(activity.created_at || ""), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

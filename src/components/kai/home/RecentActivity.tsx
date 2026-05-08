import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  UserPlus,
  UserCog,
  UserMinus,
  FileText,
  Image as ImageIcon,
  ImageOff,
  MessageSquare,
  MessageCircle,
  Sparkles,
  Bot,
  Wrench,
  PlayCircle,
  Globe,
  BarChart3,
  BookOpen,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type ActivityType =
  | "client_created"
  | "client_updated"
  | "client_deleted"
  | "template_created"
  | "template_updated"
  | "template_deleted"
  | "conversation_created"
  | "message_sent"
  | "image_generated"
  | "image_deleted"
  | "automation_created"
  | "automation_updated"
  | "automation_deleted"
  | "automation_executed"
  | "reverse_engineering_analysis"
  | "reverse_engineering_generation"
  | "document_uploaded"
  | "website_scraped"
  | "metrics_fetched"
  | "content_library_added"
  | "content_library_updated"
  | "content_library_deleted";

interface UserActivityRow {
  id: string;
  activity_type: ActivityType;
  description: string;
  entity_name: string | null;
  entity_type: string | null;
  created_at: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  client_created: UserPlus,
  client_updated: UserCog,
  client_deleted: UserMinus,
  template_created: FileText,
  template_updated: FileText,
  template_deleted: FileText,
  conversation_created: MessageSquare,
  message_sent: MessageCircle,
  image_generated: ImageIcon,
  image_deleted: ImageOff,
  automation_created: Wrench,
  automation_updated: Wrench,
  automation_deleted: Wrench,
  automation_executed: PlayCircle,
  reverse_engineering_analysis: Sparkles,
  reverse_engineering_generation: Bot,
  document_uploaded: FileText,
  website_scraped: Globe,
  metrics_fetched: BarChart3,
  content_library_added: BookOpen,
  content_library_updated: BookOpen,
  content_library_deleted: BookOpen,
};

const colorMap: Record<string, string> = {
  client_created: "text-emerald-500",
  client_updated: "text-blue-400",
  client_deleted: "text-destructive",
  template_created: "text-blue-400",
  template_deleted: "text-destructive",
  message_sent: "text-primary",
  image_generated: "text-purple-400",
  image_deleted: "text-destructive",
  automation_executed: "text-emerald-500",
  reverse_engineering_analysis: "text-amber-400",
  reverse_engineering_generation: "text-amber-400",
  document_uploaded: "text-blue-400",
  website_scraped: "text-cyan-400",
  metrics_fetched: "text-blue-400",
  content_library_added: "text-emerald-500",
  content_library_deleted: "text-destructive",
};

export function RecentActivity() {
  const { user } = useAuth();

  const { data: activities, isLoading } = useQuery({
    queryKey: ["home-recent-activity", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_activities")
        .select("id, activity_type, description, entity_name, entity_type, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as UserActivityRow[];
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5">
                  <Skeleton className="h-7 w-7 rounded-md shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !activities || activities.length === 0 ? (
            <div className="py-8 text-center">
              <Clock className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Sem atividade recente
              </p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                As ações que você fizer no KAI aparecem aqui
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {activities.map((act) => {
                const Icon = iconMap[act.activity_type] || Activity;
                const iconColor = colorMap[act.activity_type] || "text-muted-foreground";
                const when = act.created_at
                  ? formatDistanceToNow(new Date(act.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })
                  : "—";
                return (
                  <div
                    key={act.id}
                    className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/30 transition-colors"
                  >
                    <div
                      className={cn(
                        "h-7 w-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0",
                        iconColor
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground/90 leading-tight">
                        {act.description}
                        {act.entity_name && (
                          <span className="text-muted-foreground/80">
                            {" "}
                            · {act.entity_name}
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {when}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

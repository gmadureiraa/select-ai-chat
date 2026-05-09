import { CalendarDays, Clock, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isToday, isTomorrow, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UpcomingContentProps {
  clientId?: string;
  onViewPlanning: () => void;
}

export function UpcomingContent({ clientId, onViewPlanning }: UpcomingContentProps) {
  // Fetch upcoming planned content
  const { data: upcomingItems, isLoading } = useQuery({
    queryKey: ['upcoming-content', clientId],
    queryFn: async () => {
      if (!clientId) return null;
      
      const now = new Date().toISOString();
      const nextWeek = addDays(new Date(), 7).toISOString();
      
      const { data } = await supabase
        .from('kanban_cards')
        .select(`
          id,
          title,
          due_date,
          platform,
          labels,
          column_id,
          kanban_columns(name, column_type)
        `)
        .eq('client_id', clientId)
        .gte('due_date', now)
        .lte('due_date', nextWeek)
        .order('due_date', { ascending: true })
        .limit(4);
      
      return data;
    },
    enabled: !!clientId,
  });

  const formatDueDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return 'Hoje';
    if (isTomorrow(date)) return 'Amanhã';
    return format(date, "EEE, d MMM", { locale: ptBR });
  };

  const getPlatformEmoji = (platform?: string) => {
    switch (platform?.toLowerCase()) {
      case 'instagram': return '📸';
      case 'linkedin': return '💼';
      case 'twitter': return '🐦';
      case 'youtube': return '▶️';
      case 'tiktok': return '🎵';
      default: return '📝';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Próximos Conteúdos
          </h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          Próximos Conteúdos
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onViewPlanning}
          className="h-7 text-xs text-muted-foreground hover:text-foreground"
        >
          Ver tudo
          <ChevronRight className="h-3 w-3 ml-1" />
        </Button>
      </div>

      {!upcomingItems || upcomingItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 rounded-xl bg-muted/30 border border-dashed border-border">
          <CalendarDays className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhum conteúdo agendado
          </p>
          <Button
            variant="link"
            size="sm"
            onClick={onViewPlanning}
            className="text-primary mt-1"
          >
            Planejar agora
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg",
                "bg-card/50 backdrop-blur-sm border border-border/50",
                "hover:bg-card hover:border-border transition-colors cursor-pointer"
              )}
              onClick={onViewPlanning}
            >
              <span className="text-lg">{getPlatformEmoji(item.platform)}</span>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{item.due_date ? formatDueDate(item.due_date) : 'Sem data'}</span>
                  {(item as any).kanban_columns?.name && (
                    <>
                      <span>•</span>
                      <span>{(item as any).kanban_columns.name}</span>
                    </>
                  )}
                </div>
              </div>

              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

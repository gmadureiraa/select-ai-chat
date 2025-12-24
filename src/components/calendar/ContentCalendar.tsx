import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Twitter, Linkedin, AlertCircle, Check, Clock, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useScheduledPosts, ScheduledPost } from "@/hooks/useScheduledPosts";
import { SchedulePostDialog } from "./SchedulePostDialog";
import { cn } from "@/lib/utils";

interface ContentCalendarProps {
  clientId?: string;
}

export function ContentCalendar({ clientId }: ContentCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);
  
  const { posts, isLoading, retryPost } = useScheduledPosts(clientId);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getPostsForDay = (day: Date) => {
    return posts.filter(post => {
      const postDate = new Date(post.scheduled_at);
      return isSameDay(postDate, day);
    });
  };

  const getStatusIcon = (status: ScheduledPost['status']) => {
    switch (status) {
      case 'published':
        return <Check className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      case 'publishing':
        return <Loader2 className="h-3 w-3 animate-spin text-primary" />;
      case 'scheduled':
        return <Clock className="h-3 w-3 text-blue-500" />;
      default:
        return null;
    }
  };

  const getPlatformIcon = (platform: 'twitter' | 'linkedin') => {
    return platform === 'twitter' 
      ? <Twitter className="h-3 w-3" />
      : <Linkedin className="h-3 w-3" />;
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setEditingPost(null);
    setIsDialogOpen(true);
  };

  const handlePostClick = (post: ScheduledPost, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPost(post);
    setSelectedDate(new Date(post.scheduled_at));
    setIsDialogOpen(true);
  };

  const handleRetry = async (post: ScheduledPost, e: React.MouseEvent) => {
    e.stopPropagation();
    retryPost.mutate(post.id);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Calendário de Conteúdo</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium min-w-[150px] text-center">
              {format(currentDate, "MMMM yyyy", { locale: ptBR })}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button onClick={() => { setSelectedDate(new Date()); setEditingPost(null); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Agendar Post
        </Button>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 p-4 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1 h-full">
            {/* Weekday Headers */}
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}
            
            {/* Day Cells */}
            {days.map(day => {
              const dayPosts = getPostsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentDate);

              return (
                <Card
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={cn(
                    "min-h-[100px] p-2 cursor-pointer transition-colors hover:bg-muted/50",
                    !isCurrentMonth && "opacity-40",
                    isToday && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-medium",
                      isToday && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayPosts.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {dayPosts.length}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="space-y-1">
                    <TooltipProvider>
                      {dayPosts.slice(0, 3).map(post => (
                        <Tooltip key={post.id}>
                          <TooltipTrigger asChild>
                            <div
                              onClick={(e) => handlePostClick(post, e)}
                              className={cn(
                                "flex items-center gap-1 p-1 rounded text-xs truncate cursor-pointer transition-colors",
                                post.platform === 'twitter' && "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900",
                                post.platform === 'linkedin' && "bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-200 dark:hover:bg-sky-900",
                                post.status === 'failed' && "bg-red-100 dark:bg-red-950 border border-destructive"
                              )}
                            >
                              {getPlatformIcon(post.platform)}
                              {getStatusIcon(post.status)}
                              <span className="truncate flex-1">{post.title}</span>
                              {post.status === 'failed' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-4 w-4 p-0"
                                  onClick={(e) => handleRetry(post, e)}
                                >
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{post.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(post.scheduled_at), "HH:mm", { locale: ptBR })}
                              </p>
                              {post.error_message && (
                                <p className="text-xs text-destructive">{post.error_message}</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </TooltipProvider>
                    {dayPosts.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{dayPosts.length - 3} mais
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <SchedulePostDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedDate={selectedDate}
        editingPost={editingPost}
        clientId={clientId}
      />
    </div>
  );
}

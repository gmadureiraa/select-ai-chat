import { useState } from 'react';
import { Bell, Check, CheckCheck, Calendar, UserPlus, Clock, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useIsMobile } from '@/hooks/use-mobile';

const typeIcons: Record<Notification['type'], React.ElementType> = {
  assignment: UserPlus,
  due_date: Calendar,
  mention: MessageSquare,
  publish_reminder: Clock,
};

const typeColors: Record<Notification['type'], string> = {
  assignment: 'text-blue-500 bg-blue-500/10',
  due_date: 'text-orange-500 bg-orange-500/10',
  mention: 'text-purple-500 bg-purple-500/10',
  publish_reminder: 'text-green-500 bg-green-500/10',
};

function NotificationList({ 
  notifications, 
  isLoading, 
  onNotificationClick,
  onMarkAllAsRead,
  unreadCount,
  isMarkingAll
}: { 
  notifications: Notification[];
  isLoading: boolean;
  onNotificationClick: (notification: Notification) => void;
  onMarkAllAsRead: () => void;
  unreadCount: number;
  isMarkingAll: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-3 border-b">
        <h4 className="font-semibold text-sm">Notificações</h4>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onMarkAllAsRead}
            disabled={isMarkingAll}
          >
            <CheckCheck className="h-3 w-3" />
            Marcar todas
          </Button>
        )}
      </div>

      <ScrollArea className="h-[300px] md:h-[300px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-muted-foreground text-sm">Carregando...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-20 text-muted-foreground">
            <Bell className="h-8 w-8 mb-2 opacity-50" />
            <span className="text-sm">Nenhuma notificação</span>
          </div>
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              return (
                <button
                  key={notification.id}
                  className={cn(
                    'w-full text-left p-3 hover:bg-muted/50 transition-colors flex gap-3',
                    !notification.read && 'bg-primary/5'
                  )}
                  onClick={() => onNotificationClick(notification)}
                >
                  <div className={cn('p-2 rounded-full shrink-0', typeColors[notification.type])}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm line-clamp-1', !notification.read && 'font-medium')}>
                      {notification.title}
                    </p>
                    {notification.message && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="shrink-0 self-center">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead } = useNotifications();
  const isMobile = useIsMobile();

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate based on entity type
    if (notification.entity_type === 'planning_item' && notification.entity_id) {
      const slug = workspace?.slug || '';
      // Navigate to planning tab with the item ID to open
      navigate(`/${slug}?tab=planning&openItem=${notification.entity_id}`);
      setOpen(false);
    }
  };

  const bellButton = (
    <Button variant="ghost" size="icon" className="relative">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Button>
  );

  // Mobile: Use Sheet from bottom
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {bellButton}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Notificações</SheetTitle>
          </SheetHeader>
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            onNotificationClick={handleNotificationClick}
            onMarkAllAsRead={() => markAllAsRead.mutate()}
            unreadCount={unreadCount}
            isMarkingAll={markAllAsRead.isPending}
          />
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {bellButton}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <NotificationList
          notifications={notifications}
          isLoading={isLoading}
          onNotificationClick={handleNotificationClick}
          onMarkAllAsRead={() => markAllAsRead.mutate()}
          unreadCount={unreadCount}
          isMarkingAll={markAllAsRead.isPending}
        />
      </PopoverContent>
    </Popover>
  );
}
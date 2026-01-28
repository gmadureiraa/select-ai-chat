import { Menu, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  onMenuClick: () => void;
  clientName?: string;
}

export function MobileHeader({ onMenuClick, clientName }: MobileHeaderProps) {
  const { user } = useAuth();
  const { permission, requestPermission, isSupported } = usePushNotifications();

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, full_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const userInitials = user?.email?.slice(0, 2).toUpperCase() || "K";
  const showNotificationWarning = isSupported && permission !== 'granted';

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-background border-b border-border z-40 flex items-center px-3 gap-2">
      <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0 min-h-[44px] min-w-[44px]">
        <Menu className="h-5 w-5" />
      </Button>
      
      <div className="flex-1 min-w-0">
        <span className="font-semibold text-sm truncate block">
          {clientName || "KAI"}
        </span>
      </div>

      {/* Notification warning indicator */}
      {showNotificationWarning && (
        <Button 
          variant="ghost" 
          size="icon"
          onClick={requestPermission}
          className="shrink-0 text-amber-500 hover:text-amber-600 min-h-[44px] min-w-[44px]"
        >
          <BellOff className="h-5 w-5" />
        </Button>
      )}
      
      <NotificationBell />
      
      <Avatar className="h-8 w-8">
        <AvatarImage src={userProfile?.avatar_url || undefined} />
        <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
          {userInitials}
        </AvatarFallback>
      </Avatar>
    </header>
  );
}


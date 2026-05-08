import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWebPushSubscription } from '@/hooks/useWebPushSubscription';
import { useNotificationPreferences } from '@/hooks/useNotificationPreferences';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'notification-prompt-dismissed';

export function NotificationPermissionPrompt() {
  const {
    permission,
    isSupported,
    isSubscribed,
    isLoading: isSubscribing,
    subscribe,
  } = useWebPushSubscription();
  const { preferences, isLoading: isLoadingPrefs } = useNotificationPreferences();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(true); // Start as dismissed to avoid flash
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoadingPrefs) return;
    // Respect user preference: don't show if push_enabled === false
    if (preferences.push_enabled === false) return;

    // Check if already dismissed
    const wasDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(wasDismissed);

    // Only show if supported, permission is default (not granted, not denied),
    // not yet subscribed, and not dismissed
    if (
      isSupported &&
      permission === 'default' &&
      !isSubscribed &&
      !wasDismissed
    ) {
      // Delay showing to not be intrusive on first load (longer on mobile)
      const delay = isMobile ? 8000 : 5000;
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, isSubscribed, isMobile, isLoadingPrefs, preferences.push_enabled]);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleEnable = async () => {
    const ok = await subscribe();
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    if (ok) {
      trackEvent('push_subscribed', {
        source: 'permission_prompt',
        is_mobile: isMobile,
      });
      toast({
        title: 'Notificações ativadas!',
        description: 'Você receberá alertas em tempo real.',
      });
    }
  };

  if (
    !isVisible ||
    dismissed ||
    permission === 'granted' ||
    isSubscribed ||
    preferences.push_enabled === false
  ) {
    return null;
  }

  return (
    <div className={cn(
      "fixed z-50 bg-card border border-border shadow-lg animate-in duration-300",
      isMobile
        ? "bottom-0 left-0 right-0 rounded-t-xl p-4 slide-in-from-bottom-4"
        : "bottom-4 right-4 w-80 rounded-lg p-4 slide-in-from-bottom-4"
    )}>
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="p-2 rounded-full bg-primary/10 shrink-0 animate-pulse">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">Ativar notificações</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Receba alertas sobre prazos, atribuições e menções mesmo com o app em background.
          </p>
          <div className={cn("flex gap-2 mt-3", isMobile && "flex-col")}>
            <Button
              size="sm"
              onClick={handleEnable}
              disabled={isSubscribing}
              className={cn("h-8 text-xs", isMobile && "w-full")}
            >
              {isSubscribing ? 'Ativando...' : 'Ativar agora'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className={cn("h-8 text-xs", isMobile && "w-full")}>
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

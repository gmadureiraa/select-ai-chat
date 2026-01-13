import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'notification-prompt-dismissed';

export function NotificationPermissionPrompt() {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(true); // Start as dismissed to avoid flash
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(wasDismissed);
    
    // Only show if supported, not granted, and not dismissed
    if (isSupported && permission !== 'granted' && !wasDismissed) {
      // Delay showing to not be intrusive on first load (longer on mobile)
      const delay = isMobile ? 8000 : 5000;
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission, isMobile]);

  const handleDismiss = () => {
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleEnable = async () => {
    await requestPermission();
    setIsVisible(false);
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  if (!isVisible || dismissed || permission === 'granted') return null;

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
            <Button size="sm" onClick={handleEnable} className={cn("h-8 text-xs", isMobile && "w-full")}>
              Ativar agora
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


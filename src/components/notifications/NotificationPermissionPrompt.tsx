import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const STORAGE_KEY = 'notification-prompt-dismissed';

export function NotificationPermissionPrompt() {
  const { permission, isSupported, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(true); // Start as dismissed to avoid flash
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if already dismissed
    const wasDismissed = localStorage.getItem(STORAGE_KEY) === 'true';
    setDismissed(wasDismissed);
    
    // Only show if supported, not granted, and not dismissed
    if (isSupported && permission !== 'granted' && !wasDismissed) {
      // Delay showing to not be intrusive on first load
      const timer = setTimeout(() => setIsVisible(true), 5000);
      return () => clearTimeout(timer);
    }
  }, [isSupported, permission]);

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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-card border border-border rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
      
      <div className="flex items-start gap-3 pr-6">
        <div className="p-2 rounded-full bg-primary/10 shrink-0">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">Ativar notificações</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Receba alertas sobre prazos, atribuições e menções mesmo com o app em background.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleEnable} className="h-7 text-xs">
              Ativar
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-7 text-xs">
              Agora não
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

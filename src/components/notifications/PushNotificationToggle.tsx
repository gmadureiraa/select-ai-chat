import { Bell, BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";
import { useToast } from "@/hooks/use-toast";

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = useWebPushSubscription();
  const { toast } = useToast();

  if (!isSupported) {
    return null; // Don't show anything if push not supported
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast({
          title: "Notificações desativadas",
          description: "Você não receberá mais notificações push.",
        });
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast({
          title: "Notificações ativadas!",
          description: "Você receberá notificações mesmo com o app fechado.",
        });
      } else if (permission === "denied") {
        toast({
          title: "Permissão negada",
          description: "Habilite as notificações nas configurações do navegador.",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleToggle}
      disabled={isLoading}
      className="gap-2"
      title={isSubscribed ? "Desativar notificações push" : "Ativar notificações push"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isSubscribed ? (
        <Bell className="h-4 w-4 text-primary" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
      <span className="sr-only">
        {isSubscribed ? "Desativar notificações" : "Ativar notificações"}
      </span>
    </Button>
  );
}

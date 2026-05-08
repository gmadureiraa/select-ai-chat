import { useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Bell,
  BellOff,
  Loader2,
  Trash2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";
import {
  usePushSubscriptions,
  getDeviceLabel,
  type PushSubscriptionDevice,
} from "@/hooks/usePushSubscriptions";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function PushSubscriptionCard() {
  const {
    isSupported,
    isSubscribed,
    isLoading: isSubscribing,
    permission,
    subscribe,
    unsubscribe,
  } = useWebPushSubscription();
  const {
    subscriptions,
    isLoading: isLoadingDevices,
    removeSubscription,
  } = usePushSubscriptions();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // Detect which subscription belongs to the current device
  const currentEndpoint = useMemo(() => {
    if (typeof window === "undefined") return null;
    // We can't synchronously read the endpoint here. Best-effort: leave null;
    // the device list shows all entries — current one shows "Este dispositivo" badge if matches navigator.userAgent
    return null;
  }, []);

  const handleSubscribe = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({
        title: "Notificações ativadas!",
        description: "Você receberá alertas mesmo com o app fechado.",
      });
    } else if (permission === "denied") {
      toast({
        title: "Permissão negada",
        description:
          "Habilite as notificações nas configurações do navegador para este site.",
        variant: "destructive",
      });
    }
  };

  const handleUnsubscribe = async () => {
    const ok = await unsubscribe();
    if (ok) {
      toast({
        title: "Notificações desativadas",
        description: "Você não receberá mais notificações neste dispositivo.",
      });
    }
  };

  const handleRemoveDevice = (id: string) => {
    removeSubscription.mutate(id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Push notifications</CardTitle>
        </div>
        <CardDescription>
          Ative as notificações push pra receber alertas em tempo real, mesmo
          com o app fechado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status + Toggle */}
        <div
          className={cn(
            "flex gap-4 p-4 rounded-lg border",
            isSubscribed ? "bg-primary/5 border-primary/20" : "bg-muted/50",
            isMobile ? "flex-col" : "items-center justify-between",
          )}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
                isSubscribed ? "bg-primary/10" : "bg-muted",
              )}
            >
              {isSubscribed ? (
                <Bell className="h-5 w-5 text-primary" />
              ) : (
                <BellOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-medium">
                  {isSubscribed ? "Ativadas neste dispositivo" : "Desativadas"}
                </span>
                {isSubscribed && (
                  <Badge className="bg-primary/10 text-primary border-0 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Ativo
                  </Badge>
                )}
                {!isSupported && (
                  <Badge variant="outline" className="text-muted-foreground">
                    Não suportado
                  </Badge>
                )}
                {permission === "denied" && (
                  <Badge
                    variant="outline"
                    className="text-destructive border-destructive/30 gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    Bloqueado
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isSubscribed
                  ? "Esse navegador está registrado pra receber notificações."
                  : "Clique em ativar pra receber alertas em tempo real neste dispositivo."}
              </p>
            </div>
          </div>
          <div className={cn(isMobile && "self-stretch")}>
            {!isSupported ? null : isSubscribing ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className={cn(isMobile && "w-full")}
              >
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Aguarde...
              </Button>
            ) : isSubscribed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnsubscribe}
                className={cn(isMobile && "w-full")}
              >
                Desativar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubscribe}
                disabled={permission === "denied"}
                className={cn(isMobile && "w-full")}
              >
                Ativar notificações
              </Button>
            )}
          </div>
        </div>

        {permission === "denied" && (
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            As notificações foram bloqueadas. Pra ativá-las, libere o site nas
            permissões do navegador e tente de novo.
          </p>
        )}

        {/* Device list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-muted-foreground">
              Dispositivos ativos
            </h4>
            {subscriptions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {subscriptions.length}
              </Badge>
            )}
          </div>

          {isLoadingDevices ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : subscriptions.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6 bg-muted/30 rounded-lg border border-dashed">
              Nenhum dispositivo registrado.
              <br />
              Ative as notificações acima pra começar.
            </div>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <DeviceRow
                  key={sub.id}
                  subscription={sub}
                  onRemove={handleRemoveDevice}
                  isRemoving={removeSubscription.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface DeviceRowProps {
  subscription: PushSubscriptionDevice;
  onRemove: (id: string) => void;
  isRemoving: boolean;
}

function DeviceRow({ subscription, onRemove, isRemoving }: DeviceRowProps) {
  const isMobile = useIsMobile();
  const label = getDeviceLabel(subscription.device_info);
  const isCurrentDevice =
    typeof navigator !== "undefined" &&
    subscription.device_info?.userAgent === navigator.userAgent;
  const lastSeen = subscription.updated_at
    ? formatDistanceToNow(new Date(subscription.updated_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : "—";

  return (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg border bg-background",
        isMobile ? "flex-col" : "items-center justify-between",
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
          <Smartphone className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {isCurrentDevice && (
              <Badge variant="secondary" className="text-xs">
                Este dispositivo
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Atualizado {lastSeen}
            {subscription.device_info?.language &&
              ` · ${subscription.device_info.language}`}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onRemove(subscription.id)}
        disabled={isRemoving}
        className={cn(
          "text-muted-foreground hover:text-destructive",
          isMobile && "self-end",
        )}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        Remover
      </Button>
    </div>
  );
}

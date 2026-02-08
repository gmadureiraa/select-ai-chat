import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Bell, CheckCircle2, UserPlus, Calendar, Send, AtSign, Loader2, Mail, Smartphone, AlertTriangle } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

// Detectar iOS
function useIsIOS() {
  return useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
           (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }, []);
}

export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = usePushNotifications();
  const { preferences, isLoading, togglePreference, isUpdating } = useNotificationPreferences();
  const isMobile = useIsMobile();
  const isIOS = useIsIOS();

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  const notificationTypes = [
    {
      key: 'assignment_notifications' as const,
      label: 'Atribuições',
      description: 'Quando alguém atribuir um item a você',
      icon: UserPlus,
    },
    {
      key: 'due_date_notifications' as const,
      label: 'Prazos do dia',
      description: 'No início do dia, para itens agendados para hoje',
      icon: Calendar,
    },
    {
      key: 'publish_notifications' as const,
      label: 'Publicações',
      description: 'Quando uma publicação for realizada ou falhar',
      icon: Send,
    },
    {
      key: 'mention_notifications' as const,
      label: 'Menções',
      description: 'Quando você for mencionado em comentários',
      icon: AtSign,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Notificações</CardTitle>
        </div>
        <CardDescription>
          Configure como você deseja receber notificações
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* iOS Warning */}
        {isIOS && (
          <div className="flex gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-500">
                Você está no iPhone
              </p>
              <p className="text-xs text-muted-foreground">
                Notificações push no iPhone funcionam apenas quando você abre o KAI pelo ícone na tela inicial (não pelo Safari). 
                <strong className="text-foreground"> Recomendamos ativar as notificações por email</strong> para garantir que você receba tudo.
              </p>
            </div>
          </div>
        )}

        {/* Email Notifications - Recommended */}
        <div className={cn(
          "flex gap-4 p-4 rounded-lg border",
          preferences.email_notifications 
            ? "bg-primary/5 border-primary/20" 
            : "bg-muted/50 border-border",
          isMobile ? "flex-col" : "items-center justify-between"
        )}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              preferences.email_notifications ? "bg-primary/10" : "bg-muted"
            )}>
              <Mail className={cn(
                "h-5 w-5",
                preferences.email_notifications ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">
                  Notificações por Email
                </Label>
                {isIOS && (
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-0">
                    Recomendado
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Receba um email quando alguém te atribuir um card, quando uma automação rodar ou quando houver publicação/lembrete
              </p>
            </div>
          </div>
          <div className={cn(isMobile && "self-end")}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch
                checked={preferences.email_notifications}
                onCheckedChange={() => togglePreference('email_notifications')}
                disabled={isUpdating}
              />
            )}
          </div>
        </div>

        {/* Push Notifications */}
        <div className={cn(
          "flex gap-4 p-4 rounded-lg border",
          isMobile ? "flex-col" : "items-center justify-between",
          !isSupported || permission === "denied" ? "bg-muted/30" : "bg-muted/50"
        )}>
          <div className="flex items-start gap-3 min-w-0">
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              permission === "granted" ? "bg-primary/10" : "bg-muted"
            )}>
              <Smartphone className={cn(
                "h-5 w-5",
                permission === "granted" ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <div className="space-y-1">
              <Label className="text-base font-medium">
                Notificações no App (Push)
              </Label>
              <p className="text-sm text-muted-foreground">
                Receba alertas no navegador mesmo quando o app estiver fechado
                {isIOS && " (requer instalação na tela inicial)"}
              </p>
            </div>
          </div>
          <div className={cn(isMobile && "self-end")}>
            {!isSupported ? (
              <Badge variant="outline" className="text-muted-foreground">
                Não suportado
              </Badge>
            ) : permission === "granted" ? (
              <Badge className="bg-primary/10 text-primary border-0 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Ativado
              </Badge>
            ) : permission === "denied" ? (
              <Badge variant="outline" className="text-destructive border-destructive/30">
                Bloqueado
              </Badge>
            ) : (
              <Button variant="outline" size="sm" onClick={handleRequestPermission}>
                Ativar
              </Button>
            )}
          </div>
        </div>

        {permission === "denied" && (
          <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            As notificações push foram bloqueadas. Para ativá-las, acesse as configurações do seu navegador e permita notificações para este site.
            {isIOS && " Ou ative as notificações por email acima."}
          </p>
        )}

        {/* Granular notification toggles */}
        {(permission === "granted" || preferences.email_notifications) && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">
                Tipos de notificação
              </Label>
              {isUpdating && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {notificationTypes.map(({ key, label, description, icon: Icon }) => (
                  <div
                    key={key}
                    className={cn(
                      "flex gap-4 p-3 rounded-lg border transition-colors",
                      preferences[key] 
                        ? "bg-background border-border" 
                        : "bg-muted/30 border-transparent",
                      isMobile ? "flex-col" : "items-center justify-between"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                        preferences[key] ? "bg-primary/10" : "bg-muted"
                      )}>
                        <Icon className={cn(
                          "h-4 w-4",
                          preferences[key] ? "text-primary" : "text-muted-foreground"
                        )} />
                      </div>
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium cursor-pointer" htmlFor={key}>
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={key}
                      checked={preferences[key]}
                      onCheckedChange={() => togglePreference(key)}
                      disabled={isUpdating}
                      className={cn(isMobile && "self-end")}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

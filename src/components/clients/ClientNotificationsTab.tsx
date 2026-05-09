/**
 * ClientNotificationsTab — preferências de notificação contextualizadas
 * para um cliente específico.
 *
 * Estado atual (2026-05-09):
 *   As prefs no banco são por usuário+workspace, não por cliente. Esta tab
 *   funciona como um shortcut visual: mostra quais tipos de notif estão
 *   ligados pro user atual e linka direto pra Settings → Notificações pra
 *   ajustar. Quando a feature de prefs per-cliente existir, os toggles
 *   passam a salvar com `client_id={clientId}` filtrando.
 *
 * Reorg 2026-05-09 — antes a config de notificações era item solto no
 * footer da sidebar (NotificationBell) sem nenhuma noção de cliente.
 */
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Bell, UserPlus, Calendar, Send, AtSign, Mail, Smartphone,
  ExternalLink, Loader2, CheckCircle2,
} from "lucide-react";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";

interface ClientNotificationsTabProps {
  clientId: string;
  clientName: string;
}

export function ClientNotificationsTab({ clientId: _clientId, clientName }: ClientNotificationsTabProps) {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const slug = (workspace as { slug?: string })?.slug || "";
  const { preferences, isLoading, togglePreference, isUpdating } = useNotificationPreferences();
  const { permission, isSupported } = usePushNotifications();

  const handleOpenNotificationsSettings = () => {
    if (slug) {
      navigate(`/${slug}?tab=settings&section=notifications`);
    } else {
      navigate(`/kaleidos?tab=settings&section=notifications`);
    }
  };

  const notificationTypes = [
    {
      key: "assignment_notifications" as const,
      label: "Atribuições",
      description: `Quando alguém te atribuir um item de ${clientName}`,
      icon: UserPlus,
    },
    {
      key: "due_date_notifications" as const,
      label: "Prazos do dia",
      description: `Início do dia, pra itens de ${clientName} agendados pra hoje`,
      icon: Calendar,
    },
    {
      key: "publish_notifications" as const,
      label: "Publicações",
      description: `Quando uma publicação de ${clientName} for realizada ou falhar`,
      icon: Send,
    },
    {
      key: "mention_notifications" as const,
      label: "Menções",
      description: `Quando você for mencionado em comentários relacionados a ${clientName}`,
      icon: AtSign,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Notificações sobre {clientName}</CardTitle>
          </div>
          <CardDescription>
            Você recebe os tipos de notificação ativos abaixo para todos os
            clientes do workspace. Os ajustes globais ficam em Configurações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status canais */}
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Email */}
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              preferences.email_notifications
                ? "bg-primary/5 border-primary/20"
                : "bg-muted/30 border-border",
            )}>
              <div className={cn(
                "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                preferences.email_notifications ? "bg-primary/10" : "bg-muted",
              )}>
                <Mail className={cn(
                  "h-4 w-4",
                  preferences.email_notifications ? "text-primary" : "text-muted-foreground",
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-medium">Email</Label>
                  {isLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Switch
                      checked={preferences.email_notifications}
                      onCheckedChange={() => togglePreference("email_notifications")}
                      disabled={isUpdating}
                    />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {preferences.email_notifications ? "Ativado" : "Desativado"}
                </p>
              </div>
            </div>

            {/* Push */}
            <div className={cn(
              "flex items-start gap-3 p-3 rounded-lg border",
              permission === "granted"
                ? "bg-primary/5 border-primary/20"
                : "bg-muted/30 border-border",
            )}>
              <div className={cn(
                "h-9 w-9 rounded-md flex items-center justify-center shrink-0",
                permission === "granted" ? "bg-primary/10" : "bg-muted",
              )}>
                <Smartphone className={cn(
                  "h-4 w-4",
                  permission === "granted" ? "text-primary" : "text-muted-foreground",
                )} />
              </div>
              <div className="flex-1 min-w-0">
                <Label className="text-sm font-medium">Push</Label>
                <div className="text-xs">
                  {!isSupported ? (
                    <Badge variant="outline" className="mt-1 text-muted-foreground text-[10px]">
                      Não suportado
                    </Badge>
                  ) : permission === "granted" ? (
                    <Badge className="mt-1 bg-primary/10 text-primary border-0 gap-1 text-[10px]">
                      <CheckCircle2 className="h-3 w-3" /> Ativado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="mt-1 text-amber-600 border-amber-500/30 text-[10px]">
                      Pendente
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Toggles por tipo (controlam workspace-wide hoje) */}
          {(preferences.email_notifications || permission === "granted") && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Tipos de notificação
              </Label>
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {notificationTypes.map(({ key, label, description, icon: Icon }) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-start gap-3 p-2.5 rounded-md border transition-colors",
                        preferences[key]
                          ? "bg-background border-border"
                          : "bg-muted/30 border-transparent",
                      )}
                    >
                      <div className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center shrink-0",
                        preferences[key] ? "bg-primary/10" : "bg-muted",
                      )}>
                        <Icon className={cn(
                          "h-3.5 w-3.5",
                          preferences[key] ? "text-primary" : "text-muted-foreground",
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Label className="text-sm font-medium cursor-pointer" htmlFor={`client-notif-${key}`}>
                          {label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <Switch
                        id={`client-notif-${key}`}
                        checked={preferences[key]}
                        onCheckedChange={() => togglePreference(key)}
                        disabled={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenNotificationsSettings}
              className="gap-2"
            >
              <Bell className="h-3.5 w-3.5" />
              Ajustar preferências globais
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Workspace-wide
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

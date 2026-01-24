import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Bell, CheckCircle2 } from "lucide-react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function NotificationSettings() {
  const { permission, requestPermission, isSupported } = usePushNotifications();
  const isMobile = useIsMobile();

  const handleRequestPermission = async () => {
    await requestPermission();
  };

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
        {/* Push Notifications */}
        <div className={cn(
          "flex gap-4",
          isMobile ? "flex-col" : "items-center justify-between"
        )}>
          <div className="space-y-0.5 min-w-0">
            <Label className="text-base font-medium">
              Notificações Push
            </Label>
            <p className="text-sm text-muted-foreground">
              Receba alertas no navegador quando houver atualizações
            </p>
          </div>
          <div className={cn(isMobile && "self-start")}>
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
            As notificações foram bloqueadas. Para ativá-las, acesse as configurações do seu navegador e permita notificações para este site.
          </p>
        )}

        {/* Future: Email Notifications */}
        <div className={cn(
          "flex gap-4 opacity-50",
          isMobile ? "flex-col" : "items-center justify-between"
        )}>
          <div className="space-y-0.5 min-w-0">
            <Label className="text-base font-medium">
              Notificações por Email
            </Label>
            <p className="text-sm text-muted-foreground">
              Receba resumos e alertas importantes por email
            </p>
          </div>
          <div className={cn(isMobile && "self-start")}>
            <Badge variant="outline" className="text-muted-foreground">
              Em breve
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

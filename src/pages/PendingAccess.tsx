import { Clock, Mail, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

const PendingAccess = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["workspace"] });
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Aguardando Aprovação</CardTitle>
          <CardDescription className="text-base mt-2">
            Sua conta foi criada com sucesso!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Um administrador precisa aprovar seu acesso antes que você possa 
              utilizar o sistema. Você receberá uma notificação quando seu acesso 
              for liberado.
            </p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
            <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Logado como</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleRefresh}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Verificar Acesso
            </Button>
            <Button 
              variant="ghost" 
              className="w-full text-muted-foreground" 
              onClick={signOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingAccess;
